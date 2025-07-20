// backend/src/server-minimal.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

// Import routes
import authRoutes from './routes/auth-simple';
import uploadRoutes from './routes/upload-s3';
import projectRoutes from './routes/projects';
import annotationRoutes from './routes/annotations';
import userRoutes from './routes/users-s3';
import collaborationRoutes from './routes/collaboration';
import stripeRoutes from './routes/stripe';
import versionRoutes from './routes/versions';
import voiceNotesRoutes from './routes/voiceNotes';
import contactRoutes from './routes/contact';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware order is important - webhook endpoint needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Basic middleware for other routes
app.use(cors());
app.use(express.json());

// Middleware to check subscription status for protected routes
const checkSubscriptionStatus = async (req: any, res: any, next: any) => {
  // Skip check for certain routes
  const skipRoutes = [
    '/api/auth',
    '/api/stripe',
    '/health'
  ];

  const shouldSkip = skipRoutes.some(route => req.path.startsWith(route));
  if (shouldSkip) {
    return next();
  }

  // Check if user has valid subscription for protected features
  if (req.user && req.user.subscriptionStatus === 'pending') {
    return res.status(402).json({
      success: false,
      error: { 
        message: 'Payment required. Please complete your subscription to access this feature.',
        code: 'PAYMENT_REQUIRED' 
      }
    });
  }

  next();
};

// Test route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Skribble API',
    version: '1.0.0',
    features: {
      stripe_integration: true,
      referral_system: true,
      mandatory_subscriptions: true
    }
  });
});

app.get('/api/test/s3', async (req, res) => {
  try {
    const { s3UploadService } = await import('./services/s3-upload');
    const isConnected = await s3UploadService.testConnection();
    res.json({
      success: true,
      s3Connected: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'S3 test failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes - Order matters!
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes); // Stripe routes before subscription check
app.use(checkSubscriptionStatus); // Apply subscription check after auth and stripe routes

app.use('/api/upload', uploadRoutes);
app.use('/api/projects', versionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/voice-notes', voiceNotesRoutes);
app.use('/api/contact', contactRoutes);

// Static file serving for uploads
app.use('/uploads', express.static('./uploads'));

// Enhanced Socket.IO setup for real-time features
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Join project rooms for real-time collaboration
  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`User ${socket.id} joined project ${projectId}`);
  });

  // Leave project rooms
  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
    console.log(`User ${socket.id} left project ${projectId}`);
  });

  // Handle real-time annotations
  socket.on('new-annotation', (data) => {
    socket.to(`project-${data.projectId}`).emit('annotation-added', data);
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    socket.to(`project-${data.projectId}`).emit('user-typing', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`project-${data.projectId}`).emit('user-stopped-typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ Global error handler:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid JSON payload' }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method
    }
  });
});

console.log('🔄 Socket.IO events configured');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`🎵 Skribble API server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💳 Stripe integration: ${process.env.STRIPE_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);    
        
      // Validate environment variables
      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
      } else {
        console.log('✅ All required environment variables are set');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;