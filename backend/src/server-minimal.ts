// backend/src/server-minimal.ts - CORRECTED VERSION
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth-simple';
import uploadRoutes from './routes/upload';
import projectRoutes from './routes/projects';
import annotationRoutes from './routes/annotations';
import userRoutes from './routes/users';
import collaborationRoutes from './routes/collaboration';
import versionRoutes from './routes/versions';
import stripeRoutes from './routes/stripe';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const uploadsPath = process.env.NODE_ENV === 'production' 
  ? '/app/uploads'  // Railway production path
  : path.join(process.cwd(), 'uploads'); // Local development path

app.use('/uploads', express.static(uploadsPath));
console.log('📁 Serving static files from:', uploadsPath);

const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
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

app.get('/debug/uploads', (req, res) => {
  try {
    const fs = require('fs');
    const imagesPath = path.join(uploadsPath, 'images');
    const files = fs.existsSync(imagesPath) ? fs.readdirSync(imagesPath) : [];
    res.json({ 
      uploadsPath, 
      imagesPath,
      files,
      exists: fs.existsSync(imagesPath)
    });
  } catch (error: any) {
    res.json({ error: error.message });
  }
});

// API Routes - CORRECT ORDER MATTERS!
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collaboration', collaborationRoutes);

// IMPORTANT: Version routes MUST come BEFORE general project routes
// because /:projectId/versions is more specific than /:id
app.use('/api/projects', versionRoutes);
app.use('/api/projects', projectRoutes);

// Static file serving for uploads
// app.use('/uploads', express.static('./uploads'));

// Stripe routes
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/stripe', stripeRoutes);



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
    console.log(`📁 Upload directory: uploads/audio`);
    console.log(`🔗 Available routes:`);
    console.log(`   - POST /api/projects/:projectId/versions (upload new version)`);
    console.log(`   - GET /api/projects/:projectId/versions (list versions)`);
    console.log(`   - POST /api/projects/:projectId/versions/:versionNumber/activate (switch version)`);
    console.log(`   - GET /api/projects/:projectId/versions/history (version history)`);
    console.log(`   - GET /api/projects (list projects)`);
    console.log(`   - GET /api/projects/:id (get project)`);
  });
};

startServer();

export { app, server, io };