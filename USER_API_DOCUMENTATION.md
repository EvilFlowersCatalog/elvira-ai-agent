# User API Documentation

## Overview
This document describes the user-facing endpoints for managing chat sessions, listing recent chats, and resuming conversations with the Elvira AI library assistant.

## Important Update: Catalog ID Handling
As of the latest version, **catalogId** handling has been updated:
- **For browsing/searching entries**: catalogId is **OPTIONAL** - if not provided, searches across all available catalogs
- **For fetching book details**: catalogId is **REQUIRED** - must be provided when starting a chat with a specific book or when displaying books
- **User endpoints**: catalogId is **OPTIONAL** for authentication

## Authentication
All endpoints require authentication via API key. The API key can be provided in one of the following ways:
- **Authorization header**: `Authorization: Bearer <api_key>`
- **Custom header**: `x-api-key: <api_key>`
- **Query parameter**: `?apiKey=<api_key>`
- **Request body**: `{ "apiKey": "<api_key>" }`

**Optional catalogId**: Can be provided via query parameter or request body for context, but is not required for authentication.

---

## User Endpoints

### 1. List User's Chats

**Endpoint**: `GET /user/chats`

**Description**: Returns a list of all chats for the authenticated user, sorted by most recent first.

**Headers**:
```
Authorization: Bearer <api_key>
```

**Query Parameters** (all optional):
- `catalogId`: Catalog ID for context (not required)

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

**Query Parameters** (all optional):
- `catalogId`: Catalog ID for context (not required)

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

### 3. Start New Chat

**Endpoint**: `POST /api/startchat`

**Description**: Starts a new chat session. Can optionally start with a specific entry (book) in focus.

**Request Body**:
```json
{
  "apiKey": "your-api-key",
  "catalogId": "catalog-id",  // REQUIRED only if entryId is provided
  "entryId": "optional-entry-id"  // Optional: start chat focused on this book
}
```

**Response**:
```json
{
  "chatId": "new-chat-uuid"
}
```

**Status Codes**:
- `200 OK`: Chat created successfully
- `400 Bad Request`: Missing catalogId when entryId is provided
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: User is blocked
- `500 Internal Server Error`: Server error

**Notes**:
- **Without entryId**: Start a general chat - catalogId is OPTIONAL
- **With entryId**: Start chat focused on a specific book - catalogId is REQUIRED to fetch book details

---

### 4. Resume Existing Chat

**Endpoint**: `POST /api/resumechat`

**Description**: Resumes an existing chat session by loading its conversation history from the database. This allows users to continue conversations after server restarts or when reconnecting.

**Request Body**:
```json
{
  "chatId": "existing-chat-uuid",
  "apiKey": "your-api-key",
  "catalogId": "catalog-id",  // REQUIRED only if entryId is provided
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
- `400 Bad Request`: Missing chatId or missing catalogId when entryId is provided
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: User is blocked
- `404 Not Found`: Chat not found or doesn't belong to user
- `500 Internal Server Error`: Server error

**Notes**:
- The chat session is restored with full conversation history
- All previous messages are loaded into the AI context
- If the session is already active in memory, returns the existing session
- User ownership is verified before resuming
- **catalogId is REQUIRED only if resuming with an entryId**

---

### 5. Send Chat Message

**Endpoint**: `POST /api/sendchat`

**Description**: Sends a message in an existing chat session. Returns a Server-Sent Events (SSE) stream for real-time responses.

**Request Body**:
```json
{
  "chatId": "existing-chat-uuid",
  "apiKey": "your-api-key",
  "message": "Your message here",
  "entryId": "optional-entry-id"  // Optional: update focus to this book
}
```

**Response**: Server-Sent Events stream

**Event Types**:
```json
// Text chunk
{ "type": "chunk", "data": "partial response text", "msg_id": "msg_123" }

// Complete message
{ "type": "message", "data": "complete response" }

// Book display
{ "type": "entries", "data": ["entry-id-1", "entry-id-2"], "catalogId": "catalog-id" }

// Completion
{ "type": "done" }

// Error
{ "type": "error", "data": "Error message" }
```

**Status Codes**:
- `200 OK`: Stream started
- `400 Bad Request`: Missing chatId or message
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: User is blocked
- `404 Not Found`: Chat session not found
- `429 Too Many Requests`: Daily message limit exceeded

---

## Usage Examples

### Example 1: Start a General Chat (No CatalogId Needed)
```bash
curl -X POST "http://localhost:6045/api/startchat" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-api-key"
  }'
```

**Use Case**: User wants to browse and search across all available catalogs.

---

### Example 2: Start Chat with Specific Book
```bash
curl -X POST "http://localhost:6045/api/startchat" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-api-key",
    "catalogId": "catalog-123",
    "entryId": "book-456"
  }'
```

**Use Case**: User clicks on a specific book and wants to chat about it. catalogId is REQUIRED here.

---

### Example 3: List All Chats
```bash
curl -X GET "http://localhost:6045/user/chats" \
  -H "Authorization: Bearer your-api-key"
```

---

### Example 4: Get Specific Chat History
```bash
curl -X GET "http://localhost:6045/user/chats/abc-123-def-456" \
  -H "Authorization: Bearer your-api-key"
```

---

### Example 5: Resume General Chat
```bash
curl -X POST "http://localhost:6045/api/resumechat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key"
  }'
```

**Use Case**: Continue a previous conversation. No catalogId needed.

---

### Example 6: Resume Chat with Book Context
```bash
curl -X POST "http://localhost:6045/api/resumechat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key",
    "catalogId": "catalog-123",
    "entryId": "book-456"
  }'
```

**Use Case**: Resume chat and focus on a specific book. catalogId REQUIRED.

---

### Example 7: Send Message and Handle SSE Stream
```bash
curl -N -X POST "http://localhost:6045/api/sendchat" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "abc-123-def-456",
    "apiKey": "your-api-key",
    "message": "Can you recommend books about machine learning?"
  }'
```

**Note**: The `-N` flag disables buffering for streaming responses.

---

## Catalog ID Usage Patterns

### Pattern 1: Browse Mode (No Catalog Context)
```javascript
// Start chat without catalogId
const startResponse = await fetch('/api/startchat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: 'your-key' })
});

const { chatId } = await startResponse.json();

// User can search across all catalogs
// AI will display books with their catalogIds
// Details can be fetched later when AI knows the catalogId from search results
```

### Pattern 2: Book Detail Mode (Catalog Context Required)
```javascript
// User clicks on a book from catalog X
const startResponse = await fetch('/api/startchat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'your-key',
    catalogId: 'catalog-X',
    entryId: 'book-123'
  })
});

// Now AI can fetch details for this book and related books from same catalog
```

### Pattern 3: Hybrid Mode (Search Then Details)
```javascript
// Start without catalog
const { chatId } = await startChat(apiKey);

// Search returns books with catalogIds
await sendMessage(chatId, "Find books about AI");
// Response includes: { type: 'entries', data: ['book1', 'book2'], catalogId: 'catalog-X' }

// AI now knows catalogId from search results
// User can request details: "Tell me more about the first book"
// AI uses the catalogId it received from the search results
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
5. **Catalog Context**: 
   - Start WITHOUT catalogId for general browsing
   - Start WITH catalogId when focusing on a specific book
   - Let the AI discover catalogIds through search results

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message description"
}
```

### Common Errors

**Missing Catalog ID for Details**:
```json
{
  "error": "Catalog ID is required to fetch entry details. Please ensure the chat was started with a catalogId or that entries were fetched with a specific catalogId."
}
```

**Quota Exceeded (429)**:
```json
{
  "error": "Daily message limit exceeded",
  "remaining": 0,
  "limit": 100,
  "resetAt": "2025-12-12T00:00:00.000Z"
}
```

**Invalid Catalog Context (400)**:
```json
{
  "error": "Catalog ID required when starting chat with entry ID"
}
```

---

## Migration Notes

### From Previous Version

**Before**: catalogId was always required
```json
{
  "apiKey": "key",
  "catalogId": "catalog-123"  // Always required
}
```

**Now**: catalogId is optional for browsing, required for details
```json
// Browsing mode
{
  "apiKey": "key"
  // catalogId optional
}

// Detail mode
{
  "apiKey": "key",
  "catalogId": "catalog-123",  // Required when entryId provided
  "entryId": "book-456"
}
```

**Impact**:
- Existing code with catalogId will continue to work
- New code can omit catalogId for general browsing
- Entry details require catalogId to be known (from session start or search results)

---

## AI Behavior Changes

The AI assistant now handles two modes:

1. **Catalog-Agnostic Mode**: Searches across all catalogs, displays books with their catalogIds
2. **Catalog-Specific Mode**: Works within a specific catalog context, can fetch details

The AI automatically manages catalogId context based on:
- How the chat was started (with or without catalogId)
- Search results that include catalogIds
- User requests for specific book details
