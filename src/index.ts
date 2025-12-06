import dotenv from 'dotenv';
import { startServer } from './server';
import { initializeDatabase } from './database';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API key");

async function main() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Start server
    startServer();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();