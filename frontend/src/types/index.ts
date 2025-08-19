// shared/types/index.ts
// Shared TypeScript types for Skribble

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: 'free' | 'indie' | 'producer' | 'studio' | 'artist_guest';
  profileImage?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  trialStartDate?: string;
  isguest?: boolean;
  guestRole?: 'artist' | 'producer';
  temporaryAccess?: boolean;
  guestAccount?: boolean;
  trialEndDate?: string;
  guestExpiresAt?: Date;
  guestInvitedBy?: string;
  guestProjectId?: string;
}

export interface Project {
  id: string;
  title: string;
  creatorId: string;
  creator: User;
  status: 'active' | 'completed' | 'archived';
  deadline?: Date;
  shareLink: string;
  settings: ProjectSettings;
  collaborators: ProjectCollaborator[];
  audioFiles: AudioFile[];
  annotationCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  allowDownload: boolean;
  watermarkPreviews: boolean;
  autoExpire: boolean;
  expirationDate?: Date;
  maxCollaborators: number;
  requireApproval: boolean;
  allowGuestAccess?: boolean;
}

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId: string;
  user: User;
  role: 'producer' | 'artist' | 'viewer' | 'admin';
  permissions: CollaboratorPermissions;
  invitedBy: string;
  invitedAt: Date;
  acceptedAt?: Date;
  status: 'pending' | 'accepted' | 'declined';
}

export interface CollaboratorPermissions {
  canEdit: boolean;
  canComment: boolean;
  canExport: boolean;
  canInvite: boolean;
  canManageProject: boolean;
  canVoiceNote?: boolean;
}

export interface DAWMarker {
  start: number; // in seconds
  end?: number; // in seconds, optional for single markers
  label: string;
  color?: string; // Optional color for the marker
  type?: 'section' | 'comment' | 'issue'; // Type of marker
}

export interface AudioFile {
  id: string;
  projectId: string;
  version: string; // e.g., "1.0", "1.1", "2.0"
  filename: string;
  originalFilename: string;
  fileUrl: string;
  duration: number; // in seconds
  sampleRate: number;
  fileSize: number; // in bytes
  mimeType: string;
  waveformData?: number[]; // Pre-calculated waveform points
  uploadedBy: string;
  uploadedAt: Date;
  isActive: boolean; // Current version
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  invitedBy: string;
  inviteToken: string;
  role: 'producer' | 'artist' | 'viewer' | 'admin';
  permissions: CollaboratorPermissions;
  expiresAt: Date;
  usedAt?: Date;
  createsGuestAccount: boolean;
  guestUserId?: string;
  createdAt: Date;
}

export interface Annotation {
  id: string;
  audioFileId: string;
  userId: string;
  user: User;
  timestamp: number; // in seconds
  text: string;
  voiceNoteUrl?: string;
  annotationType: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'resolved' | 'approved';
  parentId?: string; // For threaded replies
  mentions: string[]; // User IDs mentioned in the annotation
  createdAt: Date;
  updatedAt: Date;
}


export interface Notification {
  id: string;
  userId: string;
  projectId: string;
  type: 'new_comment' | 'project_shared' | 'deadline_reminder' | 'version_updated' | 'mention' | 'project_completed';
  title: string;
  message: string;
  data?: Record<string, any>; // Additional notification data
  read: boolean;
  createdAt: Date;
}

// Guest account specific types
export interface GuestAccountInfo {
  isGuest: boolean;
  expiresAt?: Date;
  daysRemaining?: number;
  invitedBy?: string;
  originalProject?: string;
  needsUpgrade?: boolean;
}

export interface GuestJoinRequest {
  createGuestAccount: boolean;
  guestName?: string;
  guestEmail?: string;
}

export interface GuestJoinResponse {
  isGuestAccount: boolean;
  token?: string;
  user?: User;
  projectId: string;
  expiresIn?: number;
  message: string;
}

// Real-time events for Socket.IO
export interface SocketEvents {
  // Client to Server
  'join-project': (projectId: string) => void;
  'leave-project': (projectId: string) => void;
  'new-annotation': (annotation: Omit<Annotation, 'id' | 'user' | 'createdAt' | 'updatedAt'>) => void;
  'update-annotation': (annotationId: string, updates: Partial<Annotation>) => void;
  'delete-annotation': (annotationId: string) => void;
  'seek-to': (timestamp: number) => void;
  'play-state': (isPlaying: boolean, timestamp: number) => void;

  // Server to Client
  'annotation-created': (annotation: Annotation) => void;
  'annotation-updated': (annotation: Annotation) => void;
  'annotation-deleted': (annotationId: string) => void;
  'user-seeking': (userId: string, timestamp: number) => void;
  'user-play-state': (userId: string, isPlaying: boolean, timestamp: number) => void;
  'user-joined': (user: User) => void;
  'user-left': (userId: string) => void;
  'project-updated': (project: Partial<Project>) => void;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
    needsUpgrade?: boolean;
    requiresSignIn?: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  role: 'producer' | 'artist' | 'both';
  tier: 'indie' | 'producer' | 'studio';
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// File upload types
export interface FileUploadProgress {
  projectId: string;
  filename: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Export types
export interface ExportRequest {
  projectId: string;
  audioFileId: string;
  format: 'wav_with_cues' | 'reaper_project' | 'pro_tools' | 'logic_pro' | 'marker_file';
  includeAnnotations: boolean;
  includeVoiceNotes: boolean;
}

export interface ExportResult {
  id: string;
  downloadUrl: string;
  filename: string;
  format: string;
  fileSize: number;
  expiresAt: Date;
  createdAt: Date;
}

// Subscription and billing types
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'indie' | 'producer' | 'studio';
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeature[];
  limits: PlanLimits;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
}

export interface PlanLimits {
  maxProjects: number;
  maxCollaborators: number;
  maxFileSize: number; // in MB
  maxStorageTotal: number; // in GB
  maxAnnotationsPerProject: number;
  maxVoiceNotesPerDay?: number; // New: Daily limit for voice notes (guests)
  maxCommentsPerDay?: number; // New: Daily limit for comments (guests)
  realtimeCollaboration: boolean;
  advancedExports: boolean;
  prioritySupport: boolean;
  canCreateProjects: boolean;
  canInviteOthers: boolean;
}

// Waveform visualization types
export interface WaveformConfig {
  width: number;
  height: number;
  backgroundColor: string;
  waveColor: string;
  progressColor: string;
  cursorColor: string;
  responsive: boolean;
  pixelRatio: number;
}

export interface WaveformRegion {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  color: string;
  label?: string;
  annotationId?: string;
}

// Analytics and metrics
export interface ProjectAnalytics {
  projectId: string;
  totalAnnotations: number;
  totalCollaborators: number;
  totalVersions: number;
  averageResponseTime: number; // in hours
  collaborationEfficiency: number; // 0-100 score
  lastActivity: Date;
  guestCollaborators?: number;
}

export interface UserAnalytics {
  userId: string;
  totalProjects: number;
  totalAnnotations: number;
  totalCollaborations: number;
  averageProjectDuration: number; // in days
  collaborationRating: number; // 1-5 stars
  preferredRole: 'producer' | 'artist';
  isGuest?: boolean;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  needsUpgrade?: boolean;
}

// Utility types
export type CreateProjectData = Omit<Project, 'id' | 'creator' | 'collaborators' | 'audioFiles' | 'createdAt' | 'updatedAt' | 'shareLink'>;
export type UpdateProjectData = Partial<Pick<Project, 'title' | 'status' | 'deadline' | 'settings'>>;
export type CreateAnnotationData = Omit<Annotation, 'id' | 'user' | 'createdAt' | 'updatedAt'>;
export type UpdateAnnotationData = Partial<Pick<Annotation, 'text' | 'status' | 'priority'>>;


// Component prop types for React
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface AudioPlayerProps extends BaseComponentProps {
  audioFile: AudioFile;
  annotations: Annotation[];
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export interface AnnotationBubbleProps extends BaseComponentProps {
  annotation: Annotation;
  position: { x: number; y: number };
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotationId: string) => void;
  onReply: (annotation: Annotation) => void;
}

// Form validation schemas (for use with libraries like Zod)
export interface ProjectFormData {
  title: string;
  deadline?: string;
  allowDownload: boolean;
  watermarkPreviews: boolean;
  maxCollaborators: number;
}

export interface AnnotationFormData {
  text: string;
  timestamp: number;
  annotationType: Annotation['annotationType'];
  priority: Annotation['priority'];
}

export interface InviteCollaboratorData {
  email: string;
  role: ProjectCollaborator['role'];
  permissions: CollaboratorPermissions;
  message?: string;
}

// Subscription tier helpers
export const SUBSCRIPTION_TIERS = {
  FREE: 'free' as const,
  INDIE: 'indie' as const,
  PRODUCER: 'producer' as const,
  STUDIO: 'studio' as const,
  ARTIST_GUEST: 'artist_guest' as const,
} as const;

export const PAID_TIERS = [
  SUBSCRIPTION_TIERS.INDIE,
  SUBSCRIPTION_TIERS.PRODUCER,
  SUBSCRIPTION_TIERS.STUDIO,
] as const;

export const isPaidTier = (tier: User['subscriptionTier']): boolean => {
  return PAID_TIERS.includes(tier as any);
};

export const isGuestAccount = (user: User): boolean => {
  return user.subscriptionTier === SUBSCRIPTION_TIERS.ARTIST_GUEST;
};

export const getGuestDaysRemaining = (user: User): number | null => {
  if (!isGuestAccount(user) || !user.guestExpiresAt) return null;
  
  const expiresAt = new Date(user.guestExpiresAt);
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Analytics types
export interface AnalyticsSummary {
  totalPageViews: number;
  totalUniqueVisitors: number;
  avgDailyViews: number;
  avgSessionDuration: number;
  topCountries: CountryStat[];
  topPages: PageStat[];
  topReferrers: ReferrerStat[];
  deviceBreakdown: DeviceStat[];
  browserBreakdown: BrowserStat[];
  dailyStats: DailyStat[];
}

export interface CountryStat {
  country: string;
  views: number;
  uniqueVisitors: number;
  percentage: number;
}

export interface PageStat {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
}

export interface ReferrerStat {
  referrer: string;
  views: number;
  percentage: number;
}

export interface DeviceStat {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  views: number;
  percentage: number;
}

export interface BrowserStat {
  browser: string;
  views: number;
  percentage: number;
}

export interface DailyStat {
  date: string;
  views: number;
  uniqueVisitors: number;
  sessions: number;
}
