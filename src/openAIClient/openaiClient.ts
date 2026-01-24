import OpenAI from 'openai';
import { ResponseFunctionToolCall, ResponseInput, ResponseInputItem, ResponseOutputText } from 'openai/resources/responses/responses';
import { getTools } from './tools';
import { handleFunctionCalls } from './functionHandler';
import { ElviraClient } from '../elviraClient';

export class OpenAIClient {
    private entryId: string | null;
    private openai: OpenAI;
    private chatHistory: ResponseInput;
    private messageListener: (message: string, msg_id?: string) => void;
    private lastTokensUsed: number = 0;
    public userId: string;
    public displayBooksListener: (bookIds: string[], bookCatalogs?: Record<string, string>) => void;
    public chunkListener: (msg_id: string, chunk: string) => void;
    public elviraClient: ElviraClient;

    constructor(entryId: string | null, listeners: {
        messageListener: (message: string, msg_id?: string) => void;
        displayBooksListener: (bookIds: string[], bookCatalogs?: Record<string, string>) => void;
        chunkListener: (msg_id: string, chunk: string) => void;
    }, elviraClient: ElviraClient, userId: string) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.entryId = entryId;
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

If an Entry ID is provided:
- Focus responses on that specific entry and related content
- Continue discussing it unless the user changes the topic

Available Tools:
- getEntryDetails(id, catalogId) – Get details for a specific entry. Requires both id and catalogId.
- getEntries – Browse entries with pagination and filters. Returns entries with catalog_id field.
- displayBooks(books) – Show books in UI. Each book must have {id, catalogId}.

CRITICAL - CATALOG HANDLING:
When getEntries returns results, each entry has a "catalog_id" field.
When calling displayBooks, pass books array like: [{id: "book1", catalogId: "catalog-X"}, {id: "book2", catalogId: "catalog-Y"}]

Each book can belong to a different catalog. Extract catalog_id from the entry and pass it with that book's id.

When user asks about a book:
1. Find the book ID in conversation history
2. Look for the displayBooks call that showed it
3. Extract the catalogId used for that book
4. Call getEntryDetails(bookId, catalogId) with the correct catalogId

Example:
- displayBooks([{id:"b1", catalogId:"c1"}, {id:"b2", catalogId:"c2"}])
- User: "Tell me about the first book"
- You: getEntryDetails("b1", "c1") ← Use correct catalog!

Book displays are logged as: "[Displayed X book(s) with IDs: id1, id2, ...]"

Tool Usage:
- Use filters to narrow results based on user query
- If no results, broaden the search and try again
- Try searching in Slovak and English
- Use title filter only, unless user specifies otherwise
- Don't filter by summary/description unless explicitly requested

For non-library queries, politely state you only help with library-related inquiries.
Don't mention AI or language models. Don't help with coding or technical questions.
You may use markdown formatting for readability.
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

    public getLastTokensUsed(): number {
        return this.lastTokensUsed;
    }
}
