# User API Documentation

## Overview
This document describes the new user-facing endpoints for managing chat sessions, listing recent chats, and resuming conversations.

## Authentication
All endpoints require authentication via API key. The API key can be provided in one of the following ways:
- **Authorization header**: `Authorization: Bearer <api_key>`
- **Custom header**: `x-api-key: <api_key>`
- **Query parameter**: `?apiKey=<api_key>`
- **Request body**: `{ "apiKey": "<api_key>" }`

---

## User Endpoints

### 1. List User's Chats

**Endpoint**: `GET /user/chats`

**Description**: Returns a list of all chats for the authenticated user, sorted by most recent first.

**Headers**:
```
Authorization: Bearer <api_key>
```

**Response**:
```json
{
  "chats": [
    {
      "chatId": "uuid-string",
      "startedAt": "2025-12-11T10:30:00.000Z",
      "title": "First 50 characters of first user message",
      "messageCount": 12,
      "lastMessage": {
        "sender": "agent",
        "text": "First 100 characters of last message...",
        "timestamp": "2025-12-11T11:45:00.000Z"
      }
    }
  ],
  "total": 5
}
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid API key
- `500 Internal Server Error`: Server error

---

### 2. Get Chat History

**Endpoint**: `GET /user/chats/:chatId`

**Description**: Retrieves the full conversation history for a specific chat. The chat must belong to the authenticated user.

**Headers**:
```
Authorization: Bearer <api_key>
```

**Parameters**:
- `chatId` (path parameter): The unique identifier of the chat

**Response**:
```json
{
  "chatId": "uuid-string",
  "messages": [
    {
      "id": "msg-id-1",
      "chatId": "uuid-string",
      "sender": "user",
      "text": "What books do you have about AI?",
      "timestamp": "2025-12-11T10:30:00.000Z",
      "userId": "user-123"
    },
    {
      "id": "msg-id-2",
      "chatId": "uuid-string",
      "sender": "agent",
      "text": "I can help you find books about AI...",
      "timestamp": "2025-12-11T10:30:15.000Z",
      "msg_id": "openai-msg-id"
    }
  ],
  "messageCount": 12
}
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Chat not found or doesn't belong to user
- `500 Internal Server Error`: Server error

---

## Chat Management Endpoints

### 3. Resume Existing Chat

**Endpoint**: `POST /api/resumechat`

**Description**: Resumes an existing chat session by loading its conversation history from the database. This allows users to continue conversations after server restarts or when reconnecting.

**Request Body**:
```json
{
  "chatId": "existing-chat-uuid",
  "apiKey": "your-api-key",
  "catalogId": "catalog-id",
  "entryId": "optional-entry-id"
}
```

**Response**:
```json
{
  "chatId": "existing-chat-uuid",
  "resumed": true,
  "message": "Chat session resumed successfully"
}
```

**Status Codes**:
- `200 OK`: Chat resumed successfully
- `400 Bad Request`: Missing required fields (chatId, catalogId)
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: User is blocked
- `404 Not Found`: Chat not found or doesn't belong to user
- `500 Internal Server Error`: Server error

**Notes**:
- The chat session is restored with full conversation history
- All previous messages are loaded into the AI context
- If the session is already active in memory, it returns the existing session
- User ownership is verified before resuming

---

## Usage Examples

### Example 1: List All Chats
```bash
curl -X GET "http://localhost:6045/user/chats" \
  -H "Authorization: Bearer your-api-key"
```

### Example 2: Get Specific Chat History
```bash
curl -X GET "http://localhost:6045/user/chats/abc-123-def-456" \
  -H "Authorization: Bearer your-api-key"
```

### Example 3: Resume a Chat Session
```bash
curl -X POST "http://localhost:6045/api/resumechat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key",
    "catalogId": "your-catalog-id",
    "entryId": null
  }'
```

### Example 4: Continue Conversation After Resume
```bash
# First, resume the chat
curl -X POST "http://localhost:6045/api/resumechat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key",
    "catalogId": "your-catalog-id"
  }'

# Then, send a new message (using Server-Sent Events)
curl -X POST "http://localhost:6045/api/sendchat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key",
    "message": "Can you tell me more about the first book?"
  }'
```

---

## Session Management

### How Session Resumption Works

1. **Persistent Storage**: All messages are stored in the database as they occur
2. **Session Creation**: When resuming, the system:
   - Verifies chat ownership
   - Creates a new in-memory session
   - Loads full conversation history from database
   - Reconstructs OpenAI conversation context
3. **Context Preservation**: The AI maintains full awareness of previous conversation
4. **Restart Resilience**: Sessions can be resumed even after server restarts

### Best Practices

1. **Check Active Chats**: Use `GET /user/chats` to see available conversations
2. **Resume Before Sending**: Always call `/api/resumechat` before `/api/sendchat` for existing chats
3. **Handle Errors**: Implement proper error handling for 404 (chat not found) and 403 (blocked user)
4. **Monitor Limits**: Check daily message limits when resuming active conversations

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message description"
}
```

For quota exceeded errors (429):
```json
{
  "error": "Daily message limit exceeded",
  "remaining": 0,
  "limit": 100,
  "resetAt": "2025-12-12T00:00:00.000Z"
}
```
