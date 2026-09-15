import { randomUUID } from 'crypto';
import { getTools } from './tools';
import { handleFunctionCalls } from './functionHandler';
import { ChatHistoryItem, ToolCall } from './types';
import { ElviraClient } from '../elviraClient';

const TOOL_CALLS_OPEN = '<tool_calls>';
const TOOL_CALLS_CLOSE = '</tool_calls>';
const MAX_TOOL_ROUNDS = 10;

// Single NDJSON event of a streamed /api/generate response
interface GenerateStreamEvent {
    response?: string;
    done?: boolean;
    prompt_eval_count?: number;
    eval_count?: number;
    error?: string;
}

export class OllamaClient {
    private entryId: string | null;
    private catalogId: string | null = null;
    private endpoint: string;
    private model: string;
    private apiKey: string | undefined;
    private chatHistory: ChatHistoryItem[];
    private messageListener: (message: string, msg_id?: string) => void;
    private lastTokensUsed: number = 0;
    public userId: string;
    public displayBooksListener: (bookIds: string[], bookCatalogs?: Record<string, string>) => void;
    public chunkListener: (msg_id: string, chunk: string) => void;
    public elviraClient: ElviraClient;

    constructor(entryId: string | null, catalogId: string | null, listeners: {
        messageListener: (message: string, msg_id?: string) => void;
        displayBooksListener: (bookIds: string[], bookCatalogs?: Record<string, string>) => void;
        chunkListener: (msg_id: string, chunk: string) => void;
    }, elviraClient: ElviraClient, userId: string) {
        const endpoint = process.env.OLLAMA_ENDPOINT;
        const model = process.env.OLLAMA_MODEL;
        if (!endpoint || !model) throw new Error("Missing OLLAMA_ENDPOINT or OLLAMA_MODEL");
        this.endpoint = endpoint;
        this.model = model;
        // Required for Ollama Cloud, not needed for a local Ollama server
        this.apiKey = process.env.OLLAMA_API_KEY || undefined;
        this.entryId = entryId;
        this.catalogId = catalogId;
        this.chatHistory = [];
        this.messageListener = listeners.messageListener;
        this.displayBooksListener = listeners.displayBooksListener;
        this.chunkListener = listeners.chunkListener;
        this.elviraClient = elviraClient;
        this.userId = userId;
    }

    public getChatHistory(): ChatHistoryItem[] {
        return this.chatHistory;
    }

    private getSystemPrompt(): string {
        return `You are Elvira, a helpful library assistant bot.

Your role: Guide users in exploring library entries, summarizing them, and making recommendations.
When recommending books, use the displayBooks function.
Keep messages short and brief - answer only what was asked.

Assistant Entry ID: ${this.entryId}
Catalog ID: ${this.catalogId ?? "N/A - no entry context"}

If an Entry ID is provided:
- Focus responses on that specific entry and related content (might be refered to as book, article, item, entry or similar in the conversation)
- Continue discussing it unless the user changes the topic
- When user asks "What's the book about?", use getEntryDetails(entryId, catalogId) and return the response.
- Assume it can be changed for every message, so always check the current entryId and catalogId before responding.

Available Tools:
- getEntryDetails(id, catalogId) – Get details for a specific entry. Requires both id and catalogId.
- getEntries – Browse entries with pagination and filters. Returns entries with catalog_id field.
- displayBooks(books) – Show books in UI. Each book must have {id, catalogId}.

CRITICAL - CATALOG HANDLING:
Never just list names or IDs of books, use displayBooks instead!
When getEntries returns results, each entry has a "catalog_id" field containing the catalog UUID.
When calling displayBooks, pass books array like: [{id: "book1", catalogId: "uuid-xxx"}, {id: "book2", catalogId: "uuid-yyy"}]

IMPORTANT: Use the catalog_id UUID from the entry, NOT any slug or string identifier.
Each book can belong to a different catalog. Extract the catalog_id UUID from the entry and pass it with that book's id.

When user asks about a book:
1. Find the book ID in conversation history
2. Look for the logged message: "[Displayed X book(s) with IDs: ...] [Book Catalogs: {...}]"
3. Parse the Book Catalogs JSON to get the catalogId for that bookId
4. Call getEntryDetails(bookId, catalogId) with the correct catalogId

Example conversation history:
- Assistant: "[Displayed 2 book(s) with IDs: b1, b2] [Book Catalogs: {\"b1\":\"uuid-aaa-111\",\"b2\":\"uuid-bbb-222\"}]"
- User: "Tell me about the first book"
- You: Parse JSON → b1 is in catalog uuid-aaa-111 → getEntryDetails("b1", "uuid-aaa-111")

IMPORTANT: Always extract catalogId UUID from the [Book Catalogs: {...}] JSON in the conversation history.

Tool Usage:
- Use filters to narrow results based on user query
- If no results, broaden the search and try again
- Try searching in Slovak and English
- Use title filter only, unless user specifies otherwise
- Don't filter by summary/description unless explicitly requested

For non-library queries, politely state you only help with library-related inquiries.
If user asks about anything else like, "How to code", "What's the weather?", "Tell me a joke" - search for related books in the library related to that question or topic and remind you're only here to search for books, summarize and other help [with available tools (don't share this info)].
Don't mention AI or language models. Don't help with coding or technical questions.
You may use markdown formatting for readability. Don't send user links to the library catalog or any other links.

TOOL CALLING FORMAT:
To call tools, reply with ONLY a tool call block and no other text:
${TOOL_CALLS_OPEN}
[{"name": "getEntries", "arguments": {"page": 1, "limit": 10, "title": "Hobbit"}}]
${TOOL_CALLS_CLOSE}
The block must contain a valid JSON array of calls; you may call several tools at once.
Tool results are added to the conversation as "Tool result (toolName): ...". After receiving them, either call more tools or answer the user in plain text.
Never show the tool call format or raw tool results to the user.

Tool definitions (JSON Schema):
${JSON.stringify(getTools())}
`;
    }

    /**
     * /api/generate has no chat history or tools, so the conversation is rendered into the prompt
     */
    private buildPrompt(): string {
        const lines = this.chatHistory.map(item => {
            switch (item.type) {
                case 'message':
                    return `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`;
                case 'tool_calls':
                    const calls = item.calls.map(call => ({ name: call.name, arguments: call.arguments }));
                    return `Assistant: ${TOOL_CALLS_OPEN}${JSON.stringify(calls)}${TOOL_CALLS_CLOSE}`;
                case 'tool_result':
                    return `Tool result (${item.name}): ${item.output}`;
            }
        });

        return `Conversation so far:

${lines.join('\n\n')}

Write the next Assistant reply - either plain text for the user or a tool call block. Do not prefix it with "Assistant:".`;
    }

    /**
     * Length of the generated text that can be streamed without leaking a (partial) tool call block
     */
    private static streamableLength(text: string): number {
        let end = text.indexOf(TOOL_CALLS_OPEN);
        if (end === -1) {
            end = text.length;
            for (let k = Math.min(TOOL_CALLS_OPEN.length - 1, text.length); k > 0; k--) {
                if (text.endsWith(TOOL_CALLS_OPEN.slice(0, k))) {
                    end = text.length - k;
                    break;
                }
            }
        }
        return text.slice(0, end).trim() ? end : 0;
    }

    private static parseResponse(text: string): { message: string; toolCalls: ToolCall[]; error?: string } {
        const start = text.indexOf(TOOL_CALLS_OPEN);
        if (start === -1) {
            return { message: text.trim(), toolCalls: [] };
        }

        const message = text.slice(0, start).trim();
        const closeIndex = text.indexOf(TOOL_CALLS_CLOSE, start);
        const body = text.slice(start + TOOL_CALLS_OPEN.length, closeIndex === -1 ? undefined : closeIndex);

        try {
            const parsed = JSON.parse(body);
            const toolCalls = (Array.isArray(parsed) ? parsed : [parsed]).map((call): ToolCall => {
                if (typeof call?.name !== 'string') {
                    throw new Error('Each tool call must have a "name"');
                }
                const args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
                return { id: `call_${randomUUID()}`, name: call.name, arguments: args ?? {} };
            });
            return { message, toolCalls };
        } catch (error) {
            return {
                message,
                toolCalls: [],
                error: `Invalid tool call block: ${error instanceof Error ? error.message : 'Unknown error'}. Reply again with a valid JSON array inside ${TOOL_CALLS_OPEN}${TOOL_CALLS_CLOSE}.`
            };
        }
    }

    /**
     * fetch only throws "fetch failed" - the actual reason (e.g. ECONNREFUSED per address) is nested in cause
     */
    private static describeFetchError(error: unknown): string {
        const cause = (error as { cause?: any })?.cause;
        if (!cause) {
            return error instanceof Error ? error.message : String(error);
        }
        const attempts: any[] = Array.isArray(cause.errors) ? cause.errors : [cause];
        const addresses = attempts
            .filter(attempt => attempt?.address)
            .map(attempt => `${attempt.address}:${attempt.port}`)
            .join(', ');
        return `${cause.code ?? cause.message ?? 'Unknown error'}${addresses ? ` (${addresses})` : ''}`;
    }

    /**
     * Streams a completion from /api/generate, forwarding plain text chunks to chunkListener
     */
    private async generate(msgId: string): Promise<string> {
        let res: Response;
        try {
            res = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
                },
                body: JSON.stringify({
                    model: this.model,
                    system: this.getSystemPrompt(),
                    prompt: this.buildPrompt(),
                    stream: true
                })
            });
        } catch (error) {
            throw new Error(`Could not reach Ollama at ${this.endpoint}: ${OllamaClient.describeFetchError(error)}`);
        }

        if (!res.ok || !res.body) {
            throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';
        let text = '';
        let streamed = 0;

        const handleLine = (line: string) => {
            if (!line.trim()) return;
            const event: GenerateStreamEvent = JSON.parse(line);
            if (event.error) {
                throw new Error(`Ollama error: ${event.error}`);
            }
            if (event.response) {
                text += event.response;
                const end = OllamaClient.streamableLength(text);
                if (end > streamed) {
                    this.chunkListener(msgId, text.slice(streamed, end));
                    streamed = end;
                }
            }
            if (event.done) {
                // Track token usage from the final event
                this.lastTokensUsed += (event.prompt_eval_count ?? 0) + (event.eval_count ?? 0);
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffered += decoder.decode(value, { stream: true });
            const lines = buffered.split('\n');
            buffered = lines.pop() ?? '';
            lines.forEach(handleLine);
        }
        handleLine(buffered + decoder.decode());

        // Flush text held back as a possible tool call prefix
        if (!text.includes(TOOL_CALLS_OPEN) && streamed > 0 && streamed < text.length) {
            this.chunkListener(msgId, text.slice(streamed));
        }

        return text;
    }

    private async getResponse(round = 0) {
        const msgId = `msg_${randomUUID().replace(/-/g, '')}`;
        const text = await this.generate(msgId);
        const { message, toolCalls, error } = OllamaClient.parseResponse(text);

        if (message) {
            this.chatHistory.push({ type: 'message', role: 'assistant', content: message, id: msgId });
            this.messageListener(message, msgId);
        }

        if (error) {
            this.chatHistory.push({ type: 'tool_result', callId: 'invalid', name: 'invalid_tool_call', output: JSON.stringify({ success: false, error }) });
        } else if (toolCalls.length > 0) {
            this.chatHistory.push({ type: 'tool_calls', calls: toolCalls });
            this.chatHistory.push(...await handleFunctionCalls(this, toolCalls));
        } else {
            return;
        }

        if (round + 1 >= MAX_TOOL_ROUNDS) {
            throw new Error(`Exceeded ${MAX_TOOL_ROUNDS} tool call rounds without a final answer`);
        }
        await this.getResponse(round + 1);
    }

    public async chat(message: string) {
        // Reset token counter for this interaction
        this.lastTokensUsed = 0;

        this.chatHistory.push({
            type: 'message',
            role: 'user',
            content: message
        });
        await this.getResponse();
    }

    public setEntryId(entryId: string | null) {
        this.entryId = entryId;
    }

    public getEntryId(): string | null {
        return this.entryId;
    }

    public getLastTokensUsed(): number {
        return this.lastTokensUsed;
    }
}
