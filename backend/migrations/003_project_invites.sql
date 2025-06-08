CREATE TABLE IF NOT EXISTS project_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_token VARCHAR(64) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('producer', 'artist', 'viewer', 'admin')),
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_invites_token ON project_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_project_invites_project_id ON project_invites(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invites_expires_at ON project_invites(expires_at);