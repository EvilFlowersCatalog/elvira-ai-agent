import dotenv from 'dotenv';
import { OpenAIClient } from './openaiClient';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if(!OPENAI_API_KEY) throw new Error("Missing OpenAI API key");

const client = new OpenAIClient(OPENAI_API_KEY, null, (message) => {
    console.log("Message from OpenAI:", message);
    client.chat("Please list 10 entries for me from the api")
});
client.chat("Hello, can you help me with my library entries?");