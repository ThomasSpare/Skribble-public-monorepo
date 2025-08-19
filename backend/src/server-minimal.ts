// backend/src/server-minimal.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import redisCacheService from './services/redis-cache';
import redisService from './services/redis-service';

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
import projectsCachedRoutes from './routes/projects-cached';
import waveformRoutes from './routes/waveforms';
import analyticsRoutes from './routes/analytics';
import exportRoutes from './routes/export';

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
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-invite"]
}));
app.use(cookieParser());
app.use(express.json());

// Middleware to check subscription status for protected routes
const checkSubscriptionStatus = async (req: any, res: any, next: any) => {
  // Skip check for certain routes
  const skipRoutes = [
    '/api/auth',
    '/api/stripe',
    '/api/analytics',
    '/health'
  ];

  const shouldSkip = skipRoutes.some(route => req.path.startsWith(route));
  if (shouldSkip) {
    return next();
  }
  const isGuestInvite = req.headers['x-guest-invite'] === 'true';
  const isJoinRoute = req.path.includes('/api/collaboration/join/');
  
  if (isGuestInvite && isJoinRoute) {
    console.log('🎯 Bypassing subscription check for guest invite');
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

// Test Redis functionality
app.get('/api/test/redis', async (req, res) => {
  try {
    // Test basic operations
    const testKey = 'test:' + Date.now();
    const testData = {
      message: 'Hello Redis!',
      timestamp: new Date(),
      random: Math.random()
    };
const setResult = await redisService.set(testKey, testData, 60);
    
    // Test GET
    const getData = await redisService.get(testKey);
    
    // Test health check
    const isHealthy = await redisService.healthCheck();
    
    // Test waveform caching
    const mockWaveform = [0.1, 0.5, 0.8, 0.3, 0.9, 0.2];
    await redisService.cacheWaveform('test-audio-123', mockWaveform);
    const cachedWaveform = await redisService.getWaveform('test-audio-123');

    res.json({
      success: true,
      redis: {
        connected: isHealthy,
        connectionInfo: redisService.getConnectionInfo()
      },
      tests: {
        basicCache: {
          set: setResult,
          get: getData,
          matches: JSON.stringify(testData) === JSON.stringify(getData)
        },
        waveformCache: {
          original: mockWaveform,
          cached: cachedWaveform,
          matches: JSON.stringify(mockWaveform) === JSON.stringify(cachedWaveform)
        }
      },
      message: '🎉 Redis is working perfectly!'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: '❌ Redis test failed'
    });
  }
});

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
// Redis health check endpoint
app.get('/api/health/redis', async (req, res) => {
  const isHealthy = await redisService.healthCheck();
  const connectionInfo = redisService.getConnectionInfo();
  
  res.json({
    redis: isHealthy ? 'connected' : 'disconnected',
    connectionInfo,
    timestamp: new Date().toISOString()
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
app.use('/api/analytics', analyticsRoutes); // Analytics routes (public tracking + protected dashboard)
app.use(checkSubscriptionStatus); // Apply subscription check after auth and stripe routes

// Redis cached routes (specific paths first)
app.use('/api/waveforms', waveformRoutes);

// Upload routes (before projects to avoid conflicts)
app.use('/api/upload', uploadRoutes);

// Project routes with specific ordering for caching
// More specific routes first, then general routes
app.use('/api/projects', versionRoutes); // Handles /api/projects/:id/versions/*
app.use('/api/projects', projectsCachedRoutes); // Handles cached GET requests like /api/projects/:id
app.use('/api/projects', projectRoutes); // Handles remaining project operations

// Other API routes
app.use('/api/annotations', annotationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/voice-notes', voiceNotesRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/export', exportRoutes);

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

// Graceful shutdown for server
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Graceful shutdown for Redis connection
process.on('SIGTERM', async () => {
  console.log('🔄 Graceful shutdown starting...');
  await redisCacheService.disconnect();
  process.exit(0);
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