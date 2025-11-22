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
    type: 'message' | 'entries',
    data: string | string[]
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

export function startServer(){
    const PORT = process.env.PORT || 6045;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
