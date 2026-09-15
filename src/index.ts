import dotenv from 'dotenv';
import { startServer } from './server';
import { initializeDatabase } from './database';

dotenv.config();

if (!process.env.OLLAMA_ENDPOINT) throw new Error("Missing OLLAMA_ENDPOINT");
if (!process.env.OLLAMA_MODEL) throw new Error("Missing OLLAMA_MODEL");

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