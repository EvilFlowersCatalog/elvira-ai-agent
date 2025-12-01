import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OpenAIClient } from './openAIClient/openaiClient';
import bodyParser from 'body-parser';
import cors from 'cors';
import { ElviraClient } from './elviraClient';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: '*'
}));

// In-memory chat session store
const chatSessions: Record<string, OpenAIClient> = {};
const messagesQueue: Record<string, {
    type: 'message' | 'entries' | 'chunk',
    data: string | string[],
    msg_id?: string
}[]> = {};

function getMessagesFromQueue(chatId: string) {
    const messages = messagesQueue[chatId] || [];
    const result = [...messages];
    messagesQueue[chatId] = [];
    return result;
}

app.post('/api/startchat', (req, res) => {
    const chatId = uuidv4();
    console.log(`First message at ${chatId}`)
    const { entryId, apiKey } = req.body;
    messagesQueue[chatId] = [];
    const elviraClient = new ElviraClient(apiKey); 
    // TODO: test auth apiKey
    // GET /api/v1/users/me
    // store the user logged in session, log every message
    chatSessions[chatId] = new OpenAIClient(entryId, {
        messageListener: (message) => {
            console.log(`Agent@${chatId}:`, message);
            messagesQueue[chatId].push({ type: 'message', data: message });
        },
        displayBooksListener: (bookIds) => {
            messagesQueue[chatId].push({ type: 'entries', data: bookIds });
        },
        chunkListener: (msg_id, chunk) => {
            messagesQueue[chatId].push({ type: 'chunk', data: chunk, msg_id });
        }
    }, elviraClient)
    res.json({ chatId });
});

// POST /api/sendchat - send a message to the chat
app.post('/api/sendchat', async (req, res) => {
    const { chatId, message, entryId, apiKey } = req.body;

    if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId, message are required' });
    }

    const chatSession = chatSessions[chatId];
    if (!chatSession) {
        return res.status(404).json({ error: 'Chat session not found' });
    }

    const autheniticated = chatSession.elviraClient.validateApiKey(apiKey);

    chatSession.setEntryId(entryId);
    console.log(`User@${chatId}:`, message);
    await chatSession.chat(message);
    const messages = getMessagesFromQueue(chatId);

    res.json({ success: true, messages });
});

// POST /api/sendchat-stream - send a message to the chat with streaming response
app.post('/api/sendchat-stream', async (req, res) => {
    const { chatId, message, entryId, apiKey } = req.body;

    if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId, message are required' });
    }

    const chatSession = chatSessions[chatId];
    if (!chatSession) {
        return res.status(404).json({ error: 'Chat session not found' });
    }

    const authenticated = chatSession.elviraClient.validateApiKey(apiKey);
    if (!authenticated) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create a temporary message queue for this stream
    const streamQueue: {
        type: 'message' | 'entries' | 'chunk',
        data: string | string[],
        msg_id?: string
    }[] = [];

    // Override the listeners temporarily to capture streaming events
    const originalMessageListener = chatSession['messageListener'];
    const originalDisplayBooksListener = chatSession.displayBooksListener;
    const originalChunkListener = chatSession.chunkListener;

    chatSession['messageListener'] = (msg: string) => {
        streamQueue.push({ type: 'message', data: msg });
        res.write(`data: ${JSON.stringify({ type: 'message', data: msg })}\n\n`);
        originalMessageListener(msg);
    };

    chatSession.displayBooksListener = (bookIds: string[]) => {
        streamQueue.push({ type: 'entries', data: bookIds });
        res.write(`data: ${JSON.stringify({ type: 'entries', data: bookIds })}\n\n`);
        originalDisplayBooksListener(bookIds);
    };

    chatSession.chunkListener = (msg_id: string, chunk: string) => {
        streamQueue.push({ type: 'chunk', data: chunk, msg_id });
        res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk, msg_id })}\n\n`);
        originalChunkListener(msg_id, chunk);
    };

    chatSession.setEntryId(entryId);
    console.log(`User@${chatId}:`, message);

    try {
        await chatSession.chat(message);
        // Send completion signal
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
        console.error(`Error in chat stream ${chatId}:`, error);
        res.write(`data: ${JSON.stringify({ type: 'error', data: 'An error occurred' })}\n\n`);
    } finally {
        // Restore original listeners
        chatSession['messageListener'] = originalMessageListener;
        chatSession.displayBooksListener = originalDisplayBooksListener;
        chatSession.chunkListener = originalChunkListener;
        res.end();
    }
});

export function startServer(){
    const PORT = process.env.PORT || 6045;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
