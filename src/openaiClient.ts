import OpenAI from 'openai';
import { ResponseFunctionToolCall, ResponseInput, ResponseInputItem, ResponseOutputText } from 'openai/resources/responses/responses';
import { getTools } from './tools';
import { handleFunctionCalls } from './functionHandler';

export class OpenAIClient {
    private entryId: string | null;
    private openai: OpenAI;
    private chatHistory: ResponseInput;
    private messageListener: (message: string) => void;

    constructor(apiKey: string, entryId: string | null, messageListener: (message: string) => void) {
        this.openai = new OpenAI({ apiKey });
        this.entryId = entryId;
        this.chatHistory = [this.getSystemPrompt()];
        this.messageListener = messageListener;
    }

    private getSystemPrompt(): ResponseInputItem {
        return {
            role: "developer",
            content: [
                {
                    type: "input_text",
                    text: `You are a helpful library bot, help the user navigate within entries and provide summary, recommendations using api functions

                            Entry id: ${this.entryId}
                            If entry id is specified, you must talk about the current entry set, unless dismissed by the user.

                            use displayBook function to show books to the user, if necessary send accompanied message`
                }
            ]
        }
    }

    private async getResponse() {
        this.chatHistory[0] = this.getSystemPrompt()
        const response = await this.openai.responses.create({
            model: 'gpt-4.1',
            input: this.chatHistory,
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
            if (item.type === "message") {
                for (const content of item.content as ResponseOutputText[]) {
                    this.messageListener(content.text);
                }
            }
            if (item.type === "function_call") {
                functionCallStack.push(item);
            }
        }

        if (functionCallStack.length > 0) {
            const functionOutput = await handleFunctionCalls(functionCallStack as ResponseFunctionToolCall[]);
            this.chatHistory.push(...functionOutput);
            this.getResponse();
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
        this.getResponse();
    }
}
