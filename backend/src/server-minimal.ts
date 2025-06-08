// backend/src/server-minimal.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth-simple';
import uploadRoutes from './routes/upload';
import projectRoutes from './routes/projects';
import annotationRoutes from './routes/annotations';
import userRoutes from './routes/users';
import collaborationRoutes from './routes/collaboration';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000"
}));
app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Skribble API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collaboration', collaborationRoutes);

// Static file serving for uploads
app.use('/uploads', express.static('./uploads'));

// Add a simple auth route to test routing
async function setupRoutes() {
  try {
    const authRoutes = await import('./routes/auth-simple');
    app.use('/api/auth', authRoutes.default);
    console.log('✅ Simple routes configured successfully');
  } catch (error) {
    console.error('❌ Failed to setup routes:', error);
  }
}

// Simple Socket.IO setup
io.on('connection', (socket) => {
  console.log('🔌 User connected');
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected');
  });
});

console.log('🔄 Socket.IO events configured');

// Setup routes then start server
const startServer = async () => {
  await setupRoutes();
  
  server.listen(PORT, () => {
    console.log(`🎵 Skribble API server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Test: http://localhost:${PORT}/health`);
    console.log(`🔗 Auth test: http://localhost:${PORT}/api/auth/test`);
    console.log(`📁 Upload directory: uploads/`);
    console.log('🚀 Available routes:');
    console.log('   GET  /health');
    console.log('   POST /api/auth/register');
    console.log('   POST /api/auth/login');
    console.log('   GET  /api/auth/me');
    console.log('   POST /api/upload/project');
    console.log('   GET  /api/projects');
    console.log('   GET  /api/projects/:id');
    console.log('   POST /api/annotations');
    console.log('   GET  /api/annotations/:id');
    console.log('   GET  /api/users');
  });
};

startServer();

export { app, server, io };