import { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";
import { OpenAIClient } from "./openaiClient";
import { elviraClient } from "../elviraClient";

async function displayBooks(client: OpenAIClient, options: { ids: string[] }) {
    client.displayBooksListener(options.ids);
}

async function getEntries(options: { page: number, limit: number }) {
    return await elviraClient.getEntries(options.page, options.limit);
}

async function getEntryDetails(options: { id: string }) {
    return await elviraClient.getEntryDetail(options.id);
}

export async function handleFunctionCalls(client: OpenAIClient, functionCallStack: ResponseFunctionToolCall[]): Promise<ResponseInputItem[]> {
    const output: ResponseInputItem[] = [];
    for (const item of functionCallStack) {
        const options = JSON.parse(item.arguments);
        var result;
        switch (item.name) {
            case "displayBooks":
                result = await displayBooks(client, options);
                break;
            case "getEntries":
                result = await getEntries(options);
                break;
            case "getEntryDetails":
                result = await getEntryDetails(options);
                break;
            default:
                result = { success: false, error: "Unknown function call" };
                console.log("Unknown function call:", item.name);
                break;
        }
        output.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(result)
        });
    }
    return output;
}
