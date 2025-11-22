import OpenAI from 'openai';
import { ResponseFunctionToolCall, ResponseInput, ResponseInputItem, ResponseOutputText } from 'openai/resources/responses/responses';
import { getTools } from './tools';
import { handleFunctionCalls } from './functionHandler';
import { ElviraClient } from '../elviraClient';

export class OpenAIClient {
    private entryId: string | null;
    private openai: OpenAI;
    private chatHistory: ResponseInput;
    private messageListener: (message: string) => void;
    public displayBooksListener: (bookIds: string[]) => void;
    public elviraClient: ElviraClient;

    constructor(entryId: string | null, listeners: {
        messageListener: (message: string) => void;
        displayBooksListener: (bookIds: string[]) => void;
    }, elviraClient: ElviraClient) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.entryId = entryId;
        this.chatHistory = [];
        this.messageListener = listeners.messageListener;
        this.displayBooksListener = listeners.displayBooksListener;
        this.elviraClient = elviraClient;
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
                    getEntries – Browse multiple entries with pagination (page number and limit).
                    displayBooks – Show books in the UI based on their unique book IDs. Always send a helpful message alongside the displayed results.

                Use the tools only when needed, and always make your explanations clear, concise, and user-friendly.`
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
            tools: getTools()
        });

        const items: ResponseInputItem[] = response.output;
        this.chatHistory.push(...items);

        const functionCallStack: ResponseInputItem[] = [];

        for (const item of items) {
            switch (item.type) {
                case "message":
                    for (const content of item.content as ResponseOutputText[]) {
                        this.messageListener(content.text);
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
}
