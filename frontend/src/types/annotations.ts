// frontend/src/types/annotations.ts
export type AnnotationType = {
  id: string;
  audioFileId: string;
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    subscriptionTier: string;
    profileImage?: string;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: number;
  text: string;
  voiceNoteUrl?: string;
  annotationType: 'comment' | 'marker' | 'voice' | 'section' | 'issue' | 'approval';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'resolved' | 'approved';
  parentId?: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
};

export interface AnnotationSystemProps {
  /** The ID of the audio file being annotated */
  audioFileId: string;
  /** Current playback time in seconds */
  currentTime: number;
  /** Callback when user clicks on an annotation timestamp */
  onSeekTo: (timestamp: number) => void;
  /** The currently logged in user */
  currentUser: {
    id: string;
    username: string;
    email: string;
  };
  /** Optional callback when an annotation is deleted */
  onAnnotationDeleted?: (annotationId: string) => void;
  /** Optional callback when a new annotation is created */
  onAnnotationCreated?: (annotation: AnnotationType) => void;
  /** Optional callback when an annotation is updated */
  onAnnotationUpdated?: (annotation: AnnotationType) => void;
}

export interface AnnotationFormData {
  text: string;
  annotationType: AnnotationType['annotationType'];
  priority: AnnotationType['priority'];
  timestamp: number;
  parentId?: string;
}
