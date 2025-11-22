import { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";
import { OpenAIClient } from "./openaiClient";

async function displayBooks(client: OpenAIClient, options: { ids: string[] }) {
    client.displayBooksListener(options.ids);
    return { success: true };
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
                // TODO: validate options
                result = await client.elviraClient.getEntries(options.page, options.limit);
                break;
            case "getEntryDetails":
                // todo validate options
                result = await client.elviraClient.getEntryDetail(options.id);
                break;
            default:
                result = { success: false, error: "Unknown function call" };
                console.log("Unknown function call:", item.name);
                break;
        }
        output.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(result || {success: false, error: 'Unknown error occurred'})
        });
    }
    return output;
}
