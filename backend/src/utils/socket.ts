// backend/src/utils/socket.ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket {
  userId: string;
  email: string;
  projectId?: string;
  role?: 'producer' | 'artist' | 'viewer' | 'admin';
  permissions?: {
    canEdit?: boolean;
    canComment?: boolean;
    canExport?: boolean;
    canInvite?: boolean;
    canManageProject?: boolean;
  };
  [key: string]: any; // Allow additional properties
}

export const setupSocketEvents = (io: Server) => {
  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as AuthenticatedSocket;

    // Join project room
    socket.on('join-project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      user.projectId = projectId;
      
      // Notify others in the project
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: user.userId,
        email: user.email
      });
          });

    // Leave project room
    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      
      // Notify others in the project
      socket.to(`project:${projectId}`).emit('user-left', user.userId);
      
      console.log(`👋 User ${user.userId} left project ${projectId}`);
    });

    // Handle new annotations
    socket.on('new-annotation', (annotationData) => {
      if (user.projectId) {
        // Broadcast to all users in the project
        socket.to(`project:${user.projectId}`).emit('annotation-created', {
          ...annotationData,
          userId: user.userId,
          createdAt: new Date()
        });
      }
    });

    // Handle annotation updates
    socket.on('update-annotation', (data) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('annotation-updated', {
          annotationId: data.annotationId,
          updates: data.updates,
          updatedBy: user.userId,
          updatedAt: new Date()
        });
      }
    });

    // Handle annotation deletions
    socket.on('delete-annotation', (annotationId: string) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('annotation-deleted', {
          annotationId,
          deletedBy: user.userId
        });
      }
    });

    // Handle audio playback synchronization
    socket.on('seek-to', (timestamp: number) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-seeking', {
          userId: user.userId,
          timestamp
        });
      }
    });

    socket.on('play-state', (data: { isPlaying: boolean; timestamp: number }) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-play-state', {
          userId: user.userId,
          isPlaying: data.isPlaying,
          timestamp: data.timestamp
        });
      }
    });

    // Handle typing indicators (for annotation input)
    socket.on('typing-start', (data: { timestamp: number }) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-typing', {
          userId: user.userId,
          timestamp: data.timestamp,
          isTyping: true
        });
      }
    });

    socket.on('typing-stop', () => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-typing', {
          userId: user.userId,
          isTyping: false
        });
      }
    });

    // Handle project updates (title, settings, etc.)
    socket.on('project-updated', (updateData) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('project-updated', {
          ...updateData,
          updatedBy: user.userId,
          updatedAt: new Date()
        });
      }
    });

    // Handle cursor position sharing (where user is listening)
    socket.on('cursor-position', (timestamp: number) => {
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-cursor', {
          userId: user.userId,
          timestamp
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${user.userId}`);
      
      if (user.projectId) {
        socket.to(`project:${user.projectId}`).emit('user-left', user.userId);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${user.userId}:`, error);
    });
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  console.log('🔄 Socket.IO events configured');
};