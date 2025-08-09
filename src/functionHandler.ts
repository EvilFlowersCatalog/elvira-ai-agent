import { ResponseFunctionToolCall, ResponseInputItem } from "openai/resources/responses/responses";

export async function handleFunctionCalls(functionCallStack: ResponseFunctionToolCall[]): Promise<ResponseInputItem[]> {
    const output: ResponseInputItem[] = [];
    for (const item of functionCallStack) {
        const args = item.arguments;
        console.log("Handling function call:", item);
        output.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: `{success:true, arguments: ${JSON.stringify(args)}}`
        });
    }
    return output;
}
