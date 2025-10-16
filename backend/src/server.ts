import fastify from 'fastify';
import cors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import WebSocket from 'ws';
import { SyncWebSocketService } from './services/websocket';

// Load environment variables
dotenv.config();

const server = fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();

// ASCII Header
const ASCII_HEADER = `
dP            oo                dP          oo            dP   
  88                              88                        88   
d8888P dP    dP dP          .d888b88 .d8888b. dP .d8888b. d8888P 
  88   88    88 88 88888888 88'  \`88 88'  \`88 88 Y8ooooo.   88   
  88   88.  .88 88          88.  .88 88.  .88 88       88   88   
  dP   \`88888P' dP          \`88888P8 \`88888P' dP \`88888P'   dP   
`;

// Initialise Prisma Client
const prisma = new PrismaClient();

// Register plugins
server.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// Set up WebSocket server for real-time sync
const wss = new WebSocket.Server({ server: (server as any).server });
let syncWebSocketService: SyncWebSocketService;

// Make WebSocket service globally accessible for routes
(global as any).syncWebSocketService = null;

// Initialize WebSocket service after environment variables are loaded
const initializeWebSocket = () => {
  const todoistToken = process.env.TODOIST_API_TOKEN;
  if (todoistToken && todoistToken !== 'your_todoist_api_token_here') {
    syncWebSocketService = new SyncWebSocketService(wss, todoistToken);
    (global as any).syncWebSocketService = syncWebSocketService;
    console.log('🔄 Real-time sync WebSocket initialized');
  } else {
    console.log('⚠️ Todoist token not configured, real-time sync disabled');
  }
};

// Initialize WebSocket after a short delay to ensure env vars are loaded
setTimeout(initializeWebSocket, 1000);

// Root endpoint with API info
server.get('/', async () => {
  return {
    name: 'TUIist Backend API',
    version: '1.0.0',
    description: 'Backend API for TUIist task management application',
    endpoints: {
      health: 'GET /health',
      projects: {
        list: 'GET /api/projects',
        get: 'GET /api/projects/:id',
        create: 'POST /api/projects',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id'
      },
      tasks: {
        list: 'GET /api/tasks',
        get: 'GET /api/tasks/:id',
        create: 'POST /api/tasks',
        update: 'PUT /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id',
        toggle: 'PATCH /api/tasks/:id/toggle'
      },
      sync: {
        status: 'GET /api/sync/status',
        sync: 'POST /api/sync',
        logs: 'GET /api/sync/logs'
      },
      config: {
        todoistToken: 'POST /api/config/todoist-token'
      }
    },
    documentation: 'Use the /health endpoint to check server status'
  };
});

// Health check endpoint
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Import routes
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import dateRoutes from './routes/dates';
import syncRoutes from './routes/sync';

// Register routes
server.register(projectRoutes, { prefix: '/api/projects' });
server.register(taskRoutes, { prefix: '/api/tasks' });
server.register(dateRoutes, { prefix: '/api/dates' });
server.register(syncRoutes, { prefix: '/api/sync' });

// Config endpoint for Todoist token
server.post('/api/config/todoist-token', async (request, reply) => {
  try {
    const { token } = request.body as { token: string };

    if (!token) {
      reply.code(400);
      return { error: 'Token is required' };
    }

    // In a real app, you'd save this securely (encrypted in database)
    // For now, we'll save it to the .env file or use a simple store
    process.env.TODOIST_API_TOKEN = token;

    return { success: true, message: 'Token saved successfully' };
  } catch (error) {
    server.log.error(error);
    reply.code(500);
    return { error: 'Failed to save token' };
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    
    console.log(ASCII_HEADER);
    console.log(`🚀 TUIist Backend Server`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Unknown'}`);
    console.log('');
    
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await prisma.$disconnect();
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await prisma.$disconnect();
  await server.close();
  process.exit(0);
});

start();
