import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { connectDatabase } from './utils/database.js';
import apiRoutes from './routes/api.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function startServer() {
  try {
    await connectDatabase();

    const PORT = parseInt(config.PORT, 10);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`\n📋 API Endpoints:`);
      console.log(`   GET  /api/agents/:agentId`);
      console.log(`   POST /api/agents/:agentId/generate-tests`);
      console.log(`   GET  /api/agents/:agentId/test-suites`);
      console.log(`   POST /api/test-suites/:suiteId/execute`);
      console.log(`   POST /api/test-suites/:suiteId/optimize`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
