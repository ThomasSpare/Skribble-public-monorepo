'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

interface JoinResponse {
  success: boolean;
  data?: {
    message: string;
    projectId: string;
    role: 'producer' | 'artist' | 'viewer' | 'admin';
    permissions: {
      canEdit: boolean;
      canComment: boolean;
      canExport: boolean;
      canInvite: boolean;
      canManageProject: boolean;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    const joinProject = async () => {
      const token = localStorage.getItem('skribble_token');
      if (!token) {
        router.push(`/login?redirect=/join/${params.token}`);
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/collaboration/join/${params.token}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data: JoinResponse = await response.json();

        if (!data.success) {
          setError(data.error?.message || 'Failed to join project');
        }

        setSuccess(true);

        // Show success message briefly before redirecting
        setTimeout(() => {
          router.push(`/dashboard`);
        }, 2000);
      } catch {
        setError('An error occurred while joining the project');
      } finally {
        setIsLoading(false);
        setIsLoading(false);
      }
    };

    joinProject();
  }, [params.token, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-lg text-center">Joining project...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="mt-4 text-lg text-center text-destructive">{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-10 h-10 text-success animate-spin" />
        <p className="mt-4 text-lg text-center text-success">Successfully joined the project!</p>
        <p className="text-sm text-center text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return null;
}