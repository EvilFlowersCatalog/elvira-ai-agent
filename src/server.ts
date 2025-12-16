import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import chatRoutes from './routes/chatRoutes';
import adminRoutes from './routes/adminRoutes';
import userRoutes from './routes/userRoutes';

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: '*'
}));

// Routes
app.use('/api', chatRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export function startServer(): void {
  const PORT = process.env.PORT || 6045;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export { app };
