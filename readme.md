**Project**
- **Name**: `elvira-ai-agent` — A small Node + TypeScript AI assistant backend that connects OpenAI Responses API with an "Elvira" catalog service.

**Quick Start**
- **Prerequisites**: `Node.js 18+`, `npm`, valid OpenAI API key, and access credentials for Elvira (catalog service).
- **Environment**: Create a `.env` file in the project root containing:
	- `OPENAI_API_KEY` — your OpenAI API key (required)
	- `ELVIRA_BASE_URL` — base URL for the Elvira API (required)
	- `ELVIRA_CATALOG_ID` — catalog id used by Elvira (required)
	- `PORT` — optional port (defaults to `6045`)

- **Install**:
```
npm ci
```

- **Run in development**:
```
npm run dev
```

- **Build (TypeScript)**:
```
npm run build
```

- **Start (production)**:
```
npm run start
```

**Architecture / Overview**
- **Purpose**: Provide a backend API that manages chat sessions, forwards user messages to OpenAI Responses API, and uses a domain-specific "Elvira" catalog service to fetch and present catalog entries.
- **Main components**:
	- `src/index.ts` — entrypoint, loads env and starts server.
	- `src/server.ts` — Express server, session management, REST endpoints.
	- `src/elviraClient.ts` — wrapper client for the Elvira catalog service (REST calls).
	- `src/openAIClient/*` — OpenAI integration (responses API, tools, function handling).

**API Endpoints**
- `POST /api/startchat`
	- Body: `{ entryId?: string | null, apiKey?: string }`
	- Response: `{ chatId: string }`
	- Description: Creates a new chat session (server generates `chatId`) and instantiates `OpenAIClient` and `ElviraClient` for the session. The optional `entryId` seeds context.

- `POST /api/sendchat`
	- Body: `{ chatId: string, message: string, entryId?: string | null, apiKey?: string }`
	- Response: `{ success: true, messages: Array<{ type: 'message'|'entries', data: string|string[] }> }`
	- Description: Sends a user message to an existing chat session. Server will push the assistant response(s) (and any `entries` events) into an in-memory queue and return them.

**In-memory session behaviour**
- Sessions are kept in `server.ts` in memory using `chatSessions: Record<string, OpenAIClient>` and messages are buffered in `messagesQueue` per `chatId`.
- Note: This is intended for demo / small usage. For production scale, persist sessions and queue events to a durable store.

**Key Files & Responsibilities**
- **`src/index.ts`**: Loads environment variables using `dotenv` and starts the server with `startServer()`.
- **`src/server.ts`**:
	- Creates and configures an Express app (CORS enabled, body parsing).
	- Exposes `/api/startchat` and `/api/sendchat` endpoints.
	- Manages per-chat `OpenAIClient` instances and a simple message queue.
	- Uses `uuid` to create `chatId` values.
- **`src/elviraClient.ts`**:
	- A small wrapper around `axios` to call the Elvira REST API.
	- Constructor requires an `apiKey` and reads `ELVIRA_BASE_URL` + `ELVIRA_CATALOG_ID` from env.
	- Methods:
		- `validateApiKey(providedKey: string): boolean` — simple equality check with the provided key.
		- `getEntries(page = 1, limit = 25, pagination = true)` — GET `/api/v1/entries` with catalog params.
		- `getEntryDetail(entryId: string)` — GET `/catalogs/:catalogId/entries/:entryId`.

- **`src/openAIClient/openaiClient.ts`**:
	- Wraps the OpenAI Responses API (`openai` package) and maintains `chatHistory`.
	- Uses a System Prompt that frames the assistant as "Elvira, a helpful library assistant bot" and describes available tools.
	- Integrates function/tool support by passing `tools` (from `getTools`) and delegating tool outputs to `handleFunctionCalls`.
	- Public API:
		- `chat(message: string)` — append user message to history and retrieve responses (handles function calls recursively).
		- `setEntryId(entryId: string | null)` — update assistant context for entry focus.

- **`src/openAIClient/tools.ts`**:
	- Exposes `getTools()` returning an array of tools definitions accepted by OpenAI Responses model:
		- `getEntryDetails`, `getEntries`, `displayBooks` — each uses JSON schema for their arguments.

- **`src/openAIClient/functionHandler.ts`**:
	- Receives function call events and executes corresponding actions:
		- `displayBooks` — invokes `OpenAIClient.displayBooksListener` to push an `entries`-type message to the queue.
		- `getEntries` / `getEntryDetails` — call `ElviraClient` to fetch data and return it as function output.

**OpenAI / Model details**
- The code configures the `openai` client with `OPENAI_API_KEY` from env.
- `openai.responses.create` is called with `model: 'gpt-4.1'` and the `tools` returned by `getTools()`.
- Function calling flow:
	- Responses may include `function_call` items.
	- `functionHandler` runs those calls (using `ElviraClient`) and returns `function_call_output` items which are appended to chat history, then `getResponse()` is called again to continue the conversation.

**Environment Variables**
- `OPENAI_API_KEY` — OpenAI API key (required)
- `ELVIRA_BASE_URL` — base URL for Elvira API (required)
- `ELVIRA_CATALOG_ID` — catalog id for Elvira (required)
- `PORT` — optional server port (default `6045`)

**Docker**
- `Dockerfile` builds the TypeScript code and runs the compiled output.
- Build image:
```
docker build -t elvira-ai-agent:latest .
```
- Run container:
```
docker run -e OPENAI_API_KEY=... -e ELVIRA_BASE_URL=... -e ELVIRA_CATALOG_ID=... -p 3000:3000 elvira-ai-agent:latest
```

**TypeScript / Build**
- `tsconfig.json` compiles `src` into `out` using `commonjs` and `ES2020` target. Production start runs `node out/index.js`.

**Notes, TODOs & Caveats**
- Authentication with Elvira: currently `ElviraClient.validateApiKey` only compares the provided key to the one used when the `ElviraClient` was instantiated. Server code contains a `// TODO: test auth apiKey` comment — consider replacing this with a proper token verification endpoint against the Elvira API.
- Session persistence: sessions and message queues are in-memory. For horizontal scaling or longer-lived sessions, persist to a database or distributed cache (Redis).
- Error handling: Many network calls assume success. Add retry/backoff and improved error messages for production.

**Development & Contribution**
- To run locally:
```
cp .env.example .env    # create and populate .env
npm ci
npm run dev
```

- To build and run production:
```
npm run build
npm run start
```