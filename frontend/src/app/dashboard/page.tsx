// frontend/src/app/dashboard/page.tsx - COMPLETE FIXED VERSION
'use client';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus,
  Music, 
  Users, 
  Clock, 
  Settings, 
  LogOut, 
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  MessageCircle,
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react';
import AudioUpload from '@/components/AudioUpload';
import ProjectMenu from '@/components/ProjectMenu';
import SettingsModal from '@/components/SettingsModal';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'producer' | 'artist' | 'both';
  subscriptionTier: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string; // Optional field for last login time
  lastActive?: string; // Optional field for last active time
}

interface ProjectCollaborator {
  id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    profileImage?: string;
  };
  role: 'producer' | 'artist' | 'viewer' | 'admin';
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canExport: boolean;
    canInvite: boolean;
    canManageProject: boolean;
  };
  status: 'pending' | 'accepted' | 'declined';
}

interface AudioFile {
  id: string;
  duration?: number;
}

interface Project {
  id: string;
  title: string;
  creatorId?: string;
  creator?: {
    username: string;
  };
  collaborators?: ProjectCollaborator[];
  audioFiles?: AudioFile[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  shareLink?: string;
  deadline?: string; // ✨ NEW: Deadline field
  // Legacy fields for backward compatibility
  annotations?: number;
  lastUpdated?: string;
  duration?: string;
  showMenu?: boolean;
}

interface UploadCompleteData {
  project: {
    id: string;
    title: string;
    creatorId: string;
    createdAt: string;
    updatedAt: string;
  };
  audioFile: {
    id: string;
    duration?: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date()); // ✨ NEW: For live countdown
  const [showSettings, setShowSettings] = useState(false);

  // ✨ NEW: Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Close mobile menu when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Initialize dashboard on mount
  useEffect(() => {
    initializeDashboard();
  }, []);

  // ✨ NEW: Deadline countdown calculator (now uses currentTime for live updates)
  const calculateDeadlineCountdown = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - currentTime.getTime();
    
    if (timeDiff <= 0) {
      return { text: 'OVERDUE', isOverdue: true, isUrgent: false };
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    const isUrgent = days === 0 && hours < 24; // Less than 24 hours
    
    if (days > 0) {
      return { 
        text: `${days}d ${hours}h`, 
        isOverdue: false, 
        isUrgent: days <= 1,
        days,
        hours 
      };
    } else if (hours > 0) {
      return { 
        text: `${hours}h ${minutes}m`, 
        isOverdue: false, 
        isUrgent: true,
        days: 0,
        hours,
        minutes 
      };
    } else {
      return { 
        text: `${minutes}m`, 
        isOverdue: false, 
        isUrgent: true,
        days: 0,
        hours: 0,
        minutes 
      };
    }
  };

  const formatLastUpdated = (updatedAt: string) => {
    const date = new Date(updatedAt);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  // ✨ NEW: Set project deadline
  const handleSetDeadline = async (project: Project): Promise<void> => {
  const deadlineInput = prompt(
    'Set project deadline (YYYY-MM-DD HH:MM or YYYY-MM-DD):',
    project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : ''
  );
  
  if (!deadlineInput) return;
  
  try {
    const deadline = new Date(deadlineInput);
    if (isNaN(deadline.getTime())) {
      alert('Invalid date format. Please use YYYY-MM-DD HH:MM or YYYY-MM-DD');
      return;
    }
    
    if (deadline <= new Date()) {
      alert('Deadline must be in the future');
      return;
    }
    
    const token = localStorage.getItem('skribble_token');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deadline: deadline.toISOString()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Update project in state
        setProjects(prev => 
          prev.map(p => 
            p.id === project.id 
              ? { ...p, deadline: deadline.toISOString() }
              : p
          )
        );
        alert('Deadline set successfully!');
      } else {
        alert('Failed to set deadline');
      }
    } else {
      alert('Failed to set deadline');
    }
  } catch (error) {
    console.error('Error setting deadline:', error);
    alert('Failed to set deadline');
  }
};


  const initializeDashboard = async () => {
    
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setIsLoadingUser(true);
      
      // First, try to get user info
      const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          localStorage.removeItem('skribble_token');
          localStorage.removeItem('skribble_refresh_token');
          router.push('/login');
          return;
        }
        throw new Error(`Failed to fetch user data: ${userResponse.status}`);
      }

      const userData = await userResponse.json();

      if (userData.success && userData.data) {
        setUser(userData.data);
        
        // Now fetch projects with annotation counts
        await fetchProjects(token);
      } else {
        throw new Error('Invalid user data response');
      }
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      setError('Failed to load dashboard');
    } finally {
      setIsLoadingUser(false);
    }
  };

  // ✨ FIXED: Function to enrich projects with real annotation counts
  const enrichProjectsWithAnnotations = async (projects: Project[], token: string): Promise<Project[]> => {
    
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        try {
          // Try to get annotations for each project's audio files
          if (project.audioFiles && project.audioFiles.length > 0) {
            const audioFileId = project.audioFiles[0].id; // Get first audio file
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/annotations/audio/${audioFileId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              const annotationCount = data.success ? (data.data?.length || 0) : 0;
                          
              return {
                ...project,
                annotations: annotationCount
              };
            }
          }
          
          return {
            ...project,
            annotations: 0
          };
        } catch (error) {
          console.error(`Error fetching annotations for project ${project.id}:`, error);
          return {
            ...project,
            annotations: 0
          };
        }
      })
    );
    return enrichedProjects;
  };

  // ✨ FIXED: fetchProjects with real annotation counts
  const fetchProjects = async (token?: string) => {
    try {
      setIsLoadingProjects(true);
      setLastRefresh(new Date());
      
      const authToken = token || localStorage.getItem('skribble_token');
      if (!authToken) {
        console.error('No auth token available');
        return;
      }

      
      const projectsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        if (projectsData.success) {
          // ✨ FIXED: Enrich projects with real annotation counts
          const enrichedProjects = await enrichProjectsWithAnnotations(projectsData.data || [], authToken);
          setProjects(enrichedProjects);
          setError(null);
        }
      } else {
        console.error('Failed to fetch projects:', projectsResponse.status);
        setError('Failed to fetch projects');
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setError('Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleUploadComplete = (projectData: UploadCompleteData) => {
    const newProject: Project = {
      ...projectData.project,
      creatorId: projectData.project.creatorId || user?.id || '', // ✅ Provide fallback
      status: 'active',
      annotations: 0, // New project starts with 0 annotations
      collaborators: [],
      audioFiles: projectData.audioFile ? [{
        id: projectData.audioFile.id,
        duration: projectData.audioFile.duration
      }] : [],
      lastUpdated: new Date().toISOString(),
      duration: projectData.audioFile.duration ? 
        `${Math.floor(projectData.audioFile.duration / 60)}:${String(Math.floor(projectData.audioFile.duration % 60)).padStart(2, '0')}` : 
        '0:00'
    };

    setProjects(prev => [newProject, ...prev]);
    setShowUpload(false);
    
    // Redirect to the new project
    router.push(`/project/${newProject.id}`);
  };

  // ✨ FIXED: Enhanced stats calculation with real annotation counts
  const stats = {
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalCollaborators: projects.reduce((acc, p) => acc + (p.collaborators?.length || 0), 0),
    totalAnnotations: projects.reduce((acc, p) => acc + (p.annotations || 0), 0), // ✨ Now shows real numbers!
    totalProjects: projects.length
  };

  // ✨ FIXED: Menu handlers for project dropdown menus
  const handleMenuToggle = (projectId: string) => {
    setProjects(prev => 
      prev.map(p => ({
        ...p,
        showMenu: p.id === projectId ? !p.showMenu : false
      }))
    );
  };

  const handleMenuClose = (projectId: string) => {
    setProjects(prev => 
      prev.map(p => 
        p.id === projectId ? { ...p, showMenu: false } : p
      )
    );
  };

  // ✨ FIXED: Project action handlers
  const handleDelete = async (project: Project): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${project.title}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('skribble_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== project.id));
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete project');
    }
  };

    const handleInvite = async (project: Project): Promise<void> => {
    const token = localStorage.getItem('skribble_token');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${project.id}/invite-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'viewer',
          permissions: {
            canEdit: false,
            canComment: true,
            canExport: false,
            canInvite: false,
            canManageProject: false
          },
          expiresIn: 7 // days
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to generate invite link');
      }

      if (data.success && data.data.inviteLink) {
        // Copy link to clipboard
        await navigator.clipboard.writeText(data.data.inviteLink);
        alert('Invite link copied to clipboard! Send this link to the person you want to invite.');
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Failed to generate invite link. Please try again.');
      }
    }
  };

  const generateViewerLink = async (project: Project) => {
  try {
    const token = localStorage.getItem('skribble_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/projects/${project.id}/viewer-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate viewer link');
    }

    const data = await response.json();
    if (data.success) {
      const viewerUrl = `${window.location.origin}/viewer/${data.data.viewerToken}`;
      await navigator.clipboard.writeText(viewerUrl);
      alert('View-only link copied to clipboard!');
    }
  } catch (error) {
    console.error('Error generating viewer link:', error);
    alert(`Failed to generate viewer link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  const handleLogout = () => {
    auth.clear();
    router.push('/login');
  };

  // Show loading spinner while initializing
  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
          <p className="text-skribble-azure">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load user data</p>
          <button 
            onClick={() => router.push('/login')}
            className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-2 rounded-lg"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skribble-dark via-skribble-plum to-skribble-dark">
{/* Header */}
<header className="sticky top-0 z-40 bg-skribble-dark/95 backdrop-blur-md border-b border-skribble-azure/20">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
    <div className="flex items-center gap-3">
      {/* Logo - Larger on mobile */}
      <div className="flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="relative">
            <h1 className="font-madimi text-2xl md:text-2xl text-skribble-sky">
              Skribble
            </h1>
            <div className="absolute -top-2 -right-3 bg-skribble-azure rounded-lg px-1.5 py-0.5 shadow-lg animate-float">
              <div className="flex items-center gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Mobile Search - Always visible on mobile */}
      <div className="md:hidden flex-1 max-w-xs mx-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-skribble-dark/50 border border-skribble-azure/20 rounded-lg text-white placeholder-skribble-azure/60 focus:outline-none focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure text-sm"
          />
        </div>
      </div>

      {/* Mobile Profile Image - Standalone */}
      <div className="md:hidden flex-shrink-0">
        {user.profileImage ? (
          <img 
            src={user.profileImage} 
            alt={user.username}
            className="w-8 h-8 rounded-full border border-skribble-azure/30 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-skribble-azure to-skribble-purple flex items-center justify-center text-white font-bold text-xs">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Mobile Menu Button - Just the menu icon */}
      <div className="md:hidden relative">
        <button
          className="flex items-center justify-center text-skribble-azure hover:text-skribble-sky transition-colors p-2 relative z-50 touch-manipulation"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Open mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Mobile Dropdown Menu - Fixed positioning */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Menu Content - Enhanced visibility */}
            <div className="fixed right-2 top-16 bg-skribble-plum/100 backdrop-blur-md rounded-lg shadow-2xl border border-skribble-azure/30 p-4 z-50 min-w-[280px] max-w-[calc(100vw-1rem)] animate-slide-up">
              
              {/* User Profile Info - Mobile */}
              <div className="flex flex-col gap-3 border-b border-skribble-azure/20 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  {user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={user.username}
                      className="w-10 h-10 rounded-full border-2 border-skribble-azure/30 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-skribble-azure to-skribble-purple flex items-center justify-center text-white font-bold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-skribble-sky font-medium text-sm truncate">{user.username}</h3>
                    <p className="text-skribble-azure text-xs truncate">{user.email}</p>
                  </div>
                </div>
                
                {/* User Role & Subscription */}
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-1 bg-skribble-purple/30 text-skribble-sky rounded-full capitalize">
                    {user.role}
                  </span>
                  <span className="px-2 py-1 bg-skribble-azure/20 text-skribble-azure rounded-full capitalize">
                    {user.subscriptionTier} Plan
                  </span>
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-3 text-skribble-azure hover:text-skribble-sky hover:bg-skribble-plum/30 rounded-lg transition-colors text-left min-h-[44px] touch-manipulation"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Account Settings</span>
                </button>
                
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors text-left min-h-[44px] touch-manipulation"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>


      {/* Desktop Navigation - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
        {/* Search - Desktop */}
        <div className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-skribble-azure" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-skribble-dark/50 border border-skribble-azure/20 rounded-lg text-white placeholder-skribble-azure focus:outline-none focus:border-skribble-azure focus:ring-1 focus:ring-skribble-azure"
            />
          </div>
        </div>

        {/* User Menu - Desktop */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-skribble-azure text-sm hidden lg:block">Welcome, {user.username}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-skribble-azure hover:text-skribble-sky transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:block">Logout</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-skribble-plum/30 text-skribble-azure transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 shadow-md shadow-skribble-dark/15 hover:shadow-lg hover:shadow-skribble-azure/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-skribble-azure text-sm">Active Projects</p>
                <p className="text-2xl font-bold text-skribble-sky">{stats.activeProjects}</p>
              </div>
              <Music className="w-8 h-8 text-skribble-azure" />
            </div>
          </div>

          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 shadow-md shadow-skribble-dark/15 hover:shadow-lg hover:shadow-skribble-azure/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-skribble-azure text-sm">Collaborators</p>
                <p className="text-2xl font-bold text-skribble-sky">{stats.totalCollaborators}</p>
              </div>
              <Users className="w-8 h-8 text-skribble-azure" />
            </div>
          </div>

          {/* ✨ FIXED: Enhanced annotations display */}
          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 shadow-md shadow-skribble-dark/15 hover:shadow-lg hover:shadow-skribble-azure/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-skribble-azure text-sm">Total Annotations</p>
                <p className={`text-2xl font-bold transition-colors ${
                  stats.totalAnnotations > 0 ? 'text-skribble-sky' : 'text-skribble-purple'
                }`}>
                  {stats.totalAnnotations}
                </p>
                {stats.totalAnnotations > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    📝 Active notes
                  </p>
                )}
              </div>
              <MessageCircle className={`w-8 h-8 transition-colors ${
                stats.totalAnnotations > 0 ? 'text-skribble-sky' : 'text-skribble-azure'
              }`} />
            </div>
          </div>

          <div className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 shadow-md shadow-skribble-dark/15 hover:shadow-lg hover:shadow-skribble-azure/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-skribble-azure text-sm">Total Projects</p>
                <p className="text-2xl font-bold text-skribble-sky">{stats.totalProjects}</p>
              </div>
              <Calendar className="w-8 h-8 text-skribble-azure" />
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-madimi text-skribble-sky">Your Projects</h2>
            <div className="flex items-center gap-4">
              {/* ✨ FIXED: Refresh button with annotation count refresh */}
              <button 
                onClick={() => fetchProjects()}
                className="flex items-center gap-2 text-skribble-azure hover:text-skribble-sky transition-colors"
                disabled={isLoadingProjects}
              >
                {isLoadingProjects ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isLoadingProjects ? 'Loading...' : 'Refresh'}
              </button>
              <button 
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-4 py-2 rounded-lg shadow-lg shadow-skribble-azure/25 hover:shadow-xl hover:shadow-skribble-azure/40 transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>

          {/* Projects Grid */}
          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-skribble-azure mx-auto mb-4" />
                <p className="text-skribble-azure">Loading projects with annotation counts...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects
                .filter(project => 
                  project.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((project) => (
                <div
                  key={project.id}
                  className="bg-skribble-plum/30 backdrop-blur-md rounded-xl p-6 border border-skribble-azure/20 hover:border-skribble-azure/40 transition-all duration-300 hover:transform hover:scale-105 cursor-pointer group shadow-lg shadow-skribble-dark/20 hover:shadow-2xl hover:shadow-skribble-azure/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1" onClick={() => router.push(`/project/${project.id}`)}>
                      <h3 className="font-madimi text-lg text-skribble-sky mb-1 group-hover:text-white transition-colors">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-skribble-azure">
                        <Clock className="w-4 h-4" />
                        {project.lastUpdated || formatLastUpdated(project.updatedAt)}
                      </div>
                    </div>
                    
                    {/* ✨ FIXED: Project Menu Implementation */}
                    <div className="relative">
                      <button
                        className="p-1 text-skribble-purple hover:text-skribble-azure transition-colors"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuToggle(project.id);
                        }}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {/* ProjectMenu rendered outside the button */}
                      <ProjectMenu
                        project={project}
                        isOpen={project.showMenu || false}
                        onClose={() => handleMenuClose(project.id)}
                        onDelete={handleDelete}
                        onInvite={handleInvite}
                        onShare={generateViewerLink}
                        onSetDeadline={handleSetDeadline} // ✨ NEW: Pass deadline handler
                      />
                    </div>
                  </div>

                  {/* ✨ FIXED: Project Stats with Real Annotation Count */}
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-skribble-azure">
                        <Users className="w-4 h-4" />
                        {project.collaborators?.length || 0}
                      </div>
                      <div className="flex items-center gap-1 text-skribble-azure">
                        <MessageCircle className="w-4 h-4" />
                        <span className={`transition-colors ${
                          (project.annotations || 0) > 0 
                            ? 'text-skribble-sky font-medium' 
                            : 'text-skribble-purple'
                        }`}>
                          {project.annotations || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-skribble-azure">
                      <Clock className="w-4 h-4" />
                      {/* ✨ NEW: Deadline countdown instead of duration */}
                      {project.deadline ? (() => {
                        const countdown = calculateDeadlineCountdown(project.deadline);
                        return (
                          <span className={`font-medium ${
                            countdown.isOverdue 
                              ? 'text-red-400 animate-pulse' 
                              : countdown.isUrgent 
                              ? 'text-yellow-400' 
                              : 'text-green-400'
                          }`}>
                            {countdown.text}
                          </span>
                        );
                      })() : (
                        <span className="text-skribble-purple text-xs">No deadline</span>
                      )}
                    </div>
                  </div>

                  {/* Project Card Footer */}
                  <div className="pt-4 border-t border-skribble-azure/10">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.status === 'active' 
                          ? 'bg-green-500/20 text-green-400' 
                          : project.status === 'completed'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {project.status}
                      </span>
                      <span className="text-xs text-skribble-azure">
                        {project.creator?.username || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {projects.length === 0 && !isLoadingProjects && (
                <div className="col-span-full text-center py-12">
                  <Music className="w-16 h-16 text-skribble-purple mx-auto mb-4" />
                  <h3 className="text-xl font-madimi text-skribble-sky mb-2">No projects yet</h3>
                  <p className="text-skribble-azure mb-6">Create your first project to get started!</p>
                  <button 
                    onClick={() => setShowUpload(true)}
                    className="bg-gradient-to-r from-skribble-azure to-skribble-purple text-white px-6 py-3 rounded-lg hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
                  >
                    Create Project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <AudioUpload 
          onClose={() => setShowUpload(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}
      {showSettings && user && (
        <SettingsModal
          user={user}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onUserUpdate={setUser}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}