import { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";
import { OpenAIClient } from "./openaiClient";
import { EntryFilterOptions } from "../types";

async function displayBooks(client: OpenAIClient, options: { ids: string[] }) {
    client.displayBooksListener(options.ids);
    return { success: true };
}

/**
 * Extract filter options from function arguments
 */
function extractFilters(options: any): EntryFilterOptions | undefined {
    const filters: EntryFilterOptions = {};
    
    if (options.title) filters.title = options.title;
    if (options.summary) filters.summary = options.summary;
    if (options.category_term) filters.category_term = options.category_term;
    if (options.author) filters.author = options.author;
    if (options.language_code) filters.language_code = options.language_code;
    if (options.published_at__gte) filters.published_at__gte = options.published_at__gte;
    if (options.published_at__lte) filters.published_at__lte = options.published_at__lte;
    if (options.config__readium_enabled !== undefined) filters.config__readium_enabled = options.config__readium_enabled;
    if (options.query) filters.query = options.query;
    
    return Object.keys(filters).length > 0 ? filters : undefined;
}

export async function handleFunctionCalls(client: OpenAIClient, functionCallStack: ResponseFunctionToolCall[]): Promise<ResponseInputItem[]> {
    const output: ResponseInputItem[] = [];
    for (const item of functionCallStack) {
        const options = JSON.parse(item.arguments);
        var result;
        try {
            switch (item.name) {
                case "displayBooks":
                    console.log("Handling displayBooks function call with options:", options);
                    result = await displayBooks(client, options);
                    break;
                case "getEntries":
                    const filters = extractFilters(options);
                    result = await client.elviraClient.getEntries(options.page, options.limit, filters);
                    break;
                case "getEntryDetails":
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
        } catch (error) {
            console.error("Error handling function call:", error);
            output.push({
                type: "function_call_output",
                call_id: item.call_id,
                output: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' })
            });
        }
    }
    return output;
}
