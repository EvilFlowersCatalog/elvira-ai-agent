export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

export type ChatHistoryItem =
    | { type: 'message'; role: 'user' | 'assistant'; content: string; id?: string }
    | { type: 'tool_calls'; calls: ToolCall[] }
    | { type: 'tool_result'; callId: string; name: string; output: string };
