import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB, closeDB } from './db/connection.js';
import { ensureIndexes } from './db/indexes.js';

import categoriesRouter from './routes/categories.js';
import resourcesRouter from './routes/resources.js';
import jobsRouter from './routes/jobs.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.originalUrl.startsWith('/api')) {
        console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  });
});

// API Routes
app.use('/api/categories', categoriesRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/admin', adminRouter);

// Serve static frontend files in production
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      // In development, if dist doesn't exist yet, return a clean notice
      res.status(200).send('AI Directory API Server Running on port ' + PORT + '. Run Vite client on port 5173 for development.');
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server and Database
async function startServer() {
  try {
    const { db } = await connectDB();
    await ensureIndexes(db);

    const server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(` 🚀 AI Directory Backend running on port ${PORT}`);
      console.log(` 🌐 API Base: http://localhost:${PORT}/api`);
      console.log(` ⚙️  Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);
      console.log(`======================================================\n`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closeDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1]?.endsWith('index.js')) {
  startServer();
}

export { app, startServer };
