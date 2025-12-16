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
    public displayBooksListener: (bookIds: string[]) => void;
    public chunkListener: (msg_id: string, chunk: string) => void;
    public elviraClient: ElviraClient;

    constructor(entryId: string | null, listeners: {
        messageListener: (message: string, msg_id?: string) => void;
        displayBooksListener: (bookIds: string[]) => void;
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
        return `You are Elvira, a helpful library assistant bot. Your role is to guide the user in exploring library entries, summarizing them, and making relevant recommendations.

                When recommending a book, use the displayBooks function. Always keep the message short and brief, answer only what was asked.

                Assistant Entry Id: ${this.entryId}

                If an Entry ID is provided:
                    Focus your responses on that specific entry and its related content.
                    Continue discussing it unless the user explicitly dismisses or changes the topic.

                 You have access to the following tools:
                    getEntryDetails – Retrieve detailed information about a specific entry by its unique ID.
                    getEntries – Browse multiple entries with pagination (page number and limit) and filters.
                    displayBooks – Show books in the UI based on their unique book IDs. Always send a helpful message alongside the displayed results.

                IMPORTANT: When you display books using displayBooks, the book IDs are automatically logged in the conversation in the format:
                "[Displayed X book(s) with IDs: id1, id2, id3, ...]"
                
                You can reference these IDs later when the user asks about the displayed books. For example:
                - "Tell me more about the first book" → Use getEntryDetails with the first ID from the list
                - "What are these books about?" → Use getEntryDetails on the IDs you previously displayed
                
                Always check the conversation history for previously displayed book IDs before making new queries.

                Use the tools only when needed, and always make your explanations clear, concise, and user-friendly.
                When looking for entries, use filters to narrow down results based on user query and preferences. 
                If no results are found, remove filters, broaden the search, and try again. Try to search in slovak and english.
                Don't use multiple filters at once, use title only, unless the user specifies otherwise.
                Don't filter using summary or description unless explicitly requested.

                // TODO: Categories filtering not yet implemented. Update this section when category support is added.
                When user asks for anything else, not related to the library entries, respond politely that you are here to help with library-related inquiries only.
                Don't mention anything about AI or language models. Don't help with coding or technical questions.
                You may respond with markdown formatting for better readability.                
                `
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
