**Project**
- **Name**: `elvira-ai-agent` — A small Node + TypeScript AI assistant backend that connects an Ollama model (`/api/generate`) with an "Elvira" catalog service.

**Quick Start**
- **Prerequisites**: `Node.js 18+`, `npm`, a running Ollama server with a pulled model, and access credentials for Elvira (catalog service).
- **Environment**: Create a `.env` file in the project root containing:
	- `OLLAMA_ENDPOINT` — full URL of the Ollama generate endpoint, e.g. `http://localhost:11434/api/generate` (required)
	- `OLLAMA_MODEL` — model name, e.g. `llama3.1` (required)
	- `OLLAMA_API_KEY` — API key sent as `Authorization: Bearer` (required for Ollama Cloud, e.g. `OLLAMA_ENDPOINT=https://ollama.com/api/generate`; leave empty for local Ollama)
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
- **Purpose**: Provide a backend API that manages chat sessions, forwards user messages to an Ollama model, and uses a domain-specific "Elvira" catalog service to fetch and present catalog entries.
- **Main components**:
	- `src/index.ts` — entrypoint, loads env and starts server.
	- `src/server.ts` — Express server, session management, REST endpoints.
	- `src/elviraClient.ts` — wrapper client for the Elvira catalog service (REST calls).
	- `src/ollamaClient/*` — Ollama integration (generate API, tools, function handling).

**API Endpoints**
- `POST /api/startchat`
	- Body: `{ entryId?: string | null, apiKey?: string }`
	- Response: `{ chatId: string }`
	- Description: Creates a new chat session (server generates `chatId`) and instantiates `OllamaClient` and `ElviraClient` for the session. The optional `entryId` seeds context.

- `POST /api/sendchat`
	- Body: `{ chatId: string, message: string, entryId?: string | null, apiKey?: string }`
	- Response: `{ success: true, messages: Array<{ type: 'message'|'entries', data: string|string[] }> }`
	- Description: Sends a user message to an existing chat session. Server will push the assistant response(s) (and any `entries` events) into an in-memory queue and return them.

**In-memory session behaviour**
- Sessions are kept in memory using `chatSessions: Record<string, OllamaClient>` and messages are buffered in `messagesQueue` per `chatId`.
- Note: This is intended for demo / small usage. For production scale, persist sessions and queue events to a durable store.

**Key Files & Responsibilities**
- **`src/index.ts`**: Loads environment variables using `dotenv` and starts the server with `startServer()`.
- **`src/server.ts`**:
	- Creates and configures an Express app (CORS enabled, body parsing).
	- Exposes `/api/startchat` and `/api/sendchat` endpoints.
	- Manages per-chat `OllamaClient` instances and a simple message queue.
	- Uses `uuid` to create `chatId` values.
- **`src/elviraClient.ts`**:
	- A small wrapper around `axios` to call the Elvira REST API.
	- Constructor requires an `apiKey` and reads `ELVIRA_BASE_URL` + `ELVIRA_CATALOG_ID` from env.
	- Methods:
		- `validateApiKey(providedKey: string): boolean` — simple equality check with the provided key.
		- `getEntries(page = 1, limit = 25, pagination = true)` — GET `/api/v1/entries` with catalog params.
		- `getEntryDetail(entryId: string)` — GET `/catalogs/:catalogId/entries/:entryId`.

- **`src/ollamaClient/ollamaClient.ts`**:
	- Calls Ollama `/api/generate` (streaming NDJSON) and maintains `chatHistory`.
	- Uses a System Prompt that frames the assistant as "Elvira, a helpful library assistant bot" and describes available tools.
	- Public API:
		- `chat(message: string)` — append user message to history and retrieve responses (handles tool calls recursively).
		- `setEntryId(entryId: string | null)` — update assistant context for entry focus.

- **`src/ollamaClient/tools.ts`**:
	- Exposes `getTools()` returning tool definitions (JSON schema for arguments) that are embedded in the system prompt:
		- `getEntryDetails`, `getEntries`, `displayBooks`.

- **`src/ollamaClient/functionHandler.ts`**:
	- Receives tool calls and executes corresponding actions:
		- `displayBooks` — invokes `OllamaClient.displayBooksListener` to push an `entries`-type message to the queue.
		- `getEntries` / `getEntryDetails` — call `ElviraClient` to fetch data and return it as tool output.

**Ollama / Model details**
- Requests go to `OLLAMA_ENDPOINT` with `model: OLLAMA_MODEL`, the system prompt in `system`, and the rendered conversation in `prompt`.
- `/api/generate` has no native tool calling, so tools are handled via the prompt:
	- The model replies with a `<tool_calls>[{"name": ..., "arguments": {...}}]</tool_calls>` block when it wants to call tools.
	- `functionHandler` runs those calls (using `ElviraClient`), the results are appended to chat history, and the model is called again (up to 10 rounds per message).
	- Plain text replies are streamed to the client as `chunk` events; tool call blocks are never streamed.
- Token usage is `prompt_eval_count + eval_count` from the final stream event.

**Environment Variables**
- `OLLAMA_ENDPOINT` — Ollama generate endpoint URL (required)
- `OLLAMA_MODEL` — Ollama model name (required)
- `OLLAMA_API_KEY` — Ollama API key (required for Ollama Cloud only)
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
docker run -e OLLAMA_ENDPOINT=http://host.docker.internal:11434/api/generate -e OLLAMA_MODEL=... -e ELVIRA_BASE_URL=... -e ELVIRA_CATALOG_ID=... -p 3000:3000 elvira-ai-agent:latest
```

**TypeScript / Build**
- `tsconfig.json` compiles `src` into `out` using `commonjs` and `ES2020` target. Production start runs `node out/index.js`.

**Notes, TODOs & Caveats**
- Authentication with Elvira: currently `ElviraClient.validateApiKey` only compares the provided key to the one used when the `ElviraClient` was instantiated. Server code contains a `// TODO: test auth apiKey` comment — consider replacing this with a proper token verification endpoint against the Elvira API.
- Session persistence: sessions and message queues are in-memory. For horizontal scaling or longer-lived sessions, persist to a database or distributed cache (Redis).
- Error handling: Many network calls assume success. Add retry/backoff and improved error messages for production.
- Tool calling quality depends on the chosen model following the `<tool_calls>` format; instruction-tuned models with good JSON output work best.

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
