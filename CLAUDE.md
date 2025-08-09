# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skribble is a music collaboration platform with a Next.js frontend and Node.js/Express backend. The platform enables producers and artists to collaborate on music projects with real-time annotation, version control, and audio file sharing capabilities.

## Architecture

**Monorepo Structure:**
- `frontend/` - Next.js 14 React application with TypeScript
- `backend/` - Node.js Express API server with TypeScript  
- `shared/` - Common TypeScript types used by both frontend and backend

**Key Technologies:**
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Socket.IO client, Zustand, WaveSurfer.js
- Backend: Express 5, TypeScript, PostgreSQL, Socket.IO server, JWT auth, Stripe, AWS S3, Multer
- Database: PostgreSQL with custom migration system
- Real-time: Socket.IO for live collaboration features
- Storage: AWS S3 for audio files and images
- Authentication: JWT with refresh tokens

## Development Commands

### Frontend (in `frontend/` directory)
```bash
npm run dev          # Start Next.js development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server  
npm run lint         # Run ESLint
```

### Backend (in `backend/` directory)
```bash
npm run dev          # Start development server with nodemon (port 5000)
npm run dev:debug    # Start with Node.js inspector
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled production server
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking without compilation
```

### Database Management (in `backend/` directory)
```bash
npm run migrate:up       # Run pending migrations
npm run migrate:down     # Rollback last migration  
npm run migrate:status   # Check migration status
npm run db:reset         # Reset database (down + up + seed)
npm run setup           # Create directories and run migrations
```

### S3 Migration (in `backend/` directory)
```bash
npm run migrate:s3          # Preview S3 migration (dry run)
npm run migrate:s3:execute  # Execute S3 migration  
npm run migrate:s3:cleanup  # Clean up local files after S3 migration
```

## Project Architecture Details

### Authentication Flow
- JWT-based authentication with access and refresh tokens
- Tokens stored in localStorage on frontend
- Protected routes use middleware to verify JWT tokens
- User roles: 'producer', 'artist', 'both'
- Subscription tiers: 'free', 'indie', 'producer', 'studio'

### Real-time Collaboration
- Socket.IO handles real-time features in `/utils/socket.ts`
- Users join project rooms for live collaboration
- Events: annotations, playback synchronization, user presence
- Defined in shared types as `SocketEvents` interface

### File Upload System
- Multer handles multipart form uploads
- AWS S3 integration for scalable file storage
- Support for audio files (WAV, MP3, M4A) and images
- File processing with FFmpeg for audio analysis
- Waveform generation and metadata extraction

### Database Schema
- PostgreSQL with custom migration system in `/migrations/`
- Key tables: users, projects, project_collaborators, audio_files, annotations
- Database connection pooling with health checks
- Transaction support for complex operations

### Shared Type System
- Comprehensive TypeScript types in `/shared/types/index.ts`
- Covers all data models: User, Project, Annotation, AudioFile, etc.
- API response types and form validation schemas
- Socket.IO event type definitions

### API Structure
- RESTful API with Express routes in `/routes/`
- Middleware: authentication, error handling, rate limiting, file uploads
- Controllers handle business logic
- Services handle external integrations (S3, Stripe, email)

## Key Components

### Frontend Components
- `WaveformPlayer` - Audio playback with visualization using WaveSurfer.js
- `AnnotationSystem` - Real-time annotation management
- `ProjectMenu` - Project settings and collaboration management
- `VoiceNoteRecorder` - Voice annotation recording
- `SettingsModal` - User account and subscription management

### Backend Services
- `s3-upload.ts` - AWS S3 file management
- Authentication middleware with role-based permissions
- Database connection pooling and transaction management
- Real-time Socket.IO event handling

## Environment Configuration

### Backend Environment Variables
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
STRIPE_SECRET_KEY=sk_...
NODE_ENV=development|production
```

### Frontend Environment Variables
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Testing

- Backend uses Jest for unit and integration tests
- Test files located alongside source files with `.test.ts` extension
- Run `npm run test` or `npm run test:watch` in backend directory

## Deployment Notes

- Frontend deploys to Vercel (Next.js optimized)
- Backend can deploy to Railway, Heroku, or similar Node.js platforms  
- Database migrations run automatically on deployment
- S3 bucket required for file storage in production
- Environment variables must be configured for all external services