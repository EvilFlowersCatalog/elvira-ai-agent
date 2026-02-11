import OpenAI from 'openai';
import { ResponseFunctionToolCall, ResponseInput, ResponseInputItem, ResponseOutputText } from 'openai/resources/responses/responses';
import { getTools } from './tools';
import { handleFunctionCalls } from './functionHandler';
import { ElviraClient } from '../elviraClient';

export class OpenAIClient {
    private entryId: string | null;
    private catalogId: string | null = null;
    private openai: OpenAI;
    private chatHistory: ResponseInput;
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
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.entryId = entryId;
        this.catalogId = catalogId;
        this.chatHistory = [];
        this.messageListener = listeners.messageListener;
        this.displayBooksListener = listeners.displayBooksListener;
        this.chunkListener = listeners.chunkListener;
        this.elviraClient = elviraClient;
        this.userId = userId;
    }

    public getChatHistory(): ResponseInput {
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
Don't mention AI or language models. Don't help with coding or technical questions.
You may use markdown formatting for readability. Don't send user links to the library catalog or any other links.
`;
    }


    private async getResponse() {
        const response = await this.openai.responses.create({
            model: 'gpt-4.1',
            input: this.chatHistory,
            instructions: this.getSystemPrompt(),
            text: {
                "format": {
                    "type": "text"
                },
                "verbosity": "medium"
            },
            tools: getTools(),
            stream: true
        });

        let items: ResponseInputItem[] = [];

        for await (const chunk of response) {
            if (chunk.type == "response.output_text.delta") {
                if ('delta' in chunk) {
                    this.chunkListener(chunk.item_id, chunk.delta);
                }
            }
            else if (chunk.type == "response.completed") {
                items.push(...chunk.response.output);
                // Track token usage from the completed response
                if (chunk.response.usage) {
                    this.lastTokensUsed += chunk.response.usage.total_tokens || 0;
                }
            }
        }

        this.chatHistory.push(...items);

        const functionCallStack: ResponseInputItem[] = [];

        for (const item of items) {
            switch (item.type) {
                case "message":
                    // Extract msg_id from the message item
                    const msgId = 'id' in item ? item.id : undefined;
                    for (const content of item.content as ResponseOutputText[]) {
                        this.messageListener(content.text, msgId);
                    }
                    break;
                case "function_call":
                    functionCallStack.push(item);
                    break;
                default:
                    // possibly reasoning, or other unnecessary processing
                    console.log("Unhandled response item type:", item.type);
                    break;
            }
        }

        if (functionCallStack.length > 0) {
            const functionOutput = await handleFunctionCalls(this, functionCallStack as ResponseFunctionToolCall[]);
            this.chatHistory.push(...functionOutput);
            await this.getResponse();
        }

    }

    public async chat(message: string) {
        // Reset token counter for this interaction
        this.lastTokensUsed = 0;
        
        this.chatHistory.push({
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: message
                }
            ]
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
