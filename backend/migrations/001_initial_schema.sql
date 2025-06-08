-- backend/migrations/001_initial_schema.sql
-- Skribble Database Schema - Fixed Version

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('producer', 'artist', 'both')),
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'indie', 'producer', 'studio')),
  profile_image VARCHAR(500),
  stripe_customer_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  deadline TIMESTAMP WITH TIME ZONE,
  share_link VARCHAR(50) UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio Files table
CREATE TABLE IF NOT EXISTS audio_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  duration FLOAT NOT NULL,
  sample_rate INTEGER NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  waveform_data JSONB,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Annotations table
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp FLOAT NOT NULL,
  text TEXT NOT NULL,
  voice_note_url VARCHAR(500),
  annotation_type VARCHAR(20) NOT NULL DEFAULT 'comment' 
    CHECK (annotation_type IN ('comment', 'marker', 'voice', 'section', 'issue', 'approval')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in-progress', 'resolved', 'approved')),
  parent_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
  mentions TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Collaborators table
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('producer', 'artist', 'viewer', 'admin')),
  permissions JSONB NOT NULL DEFAULT '{}',
  invited_by UUID NOT NULL REFERENCES users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  UNIQUE(project_id, user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'new_comment', 'project_shared', 'deadline_reminder', 'version_updated', 
    'mention', 'project_completed', 'collaborator_joined', 'annotation_resolved'
  )),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_share_link ON projects(share_link);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_audio_files_project_id ON audio_files(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_version ON audio_files(project_id, version);
CREATE INDEX IF NOT EXISTS idx_annotations_audio_file_id ON annotations(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON annotations(audio_file_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);