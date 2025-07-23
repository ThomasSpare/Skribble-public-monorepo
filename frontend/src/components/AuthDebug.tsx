// frontend/src/components/AuthDebug.tsx - ADD THIS TO YOUR PROJECT PAGE TEMPORARILY
'use client';
import { useEffect, useState } from 'react';

export default function AuthDebug() {
  const [authInfo, setAuthInfo] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('skribble_token');
    const user = localStorage.getItem('skribble_user');
    
    setAuthInfo({
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'None',
      hasUser: !!user,
      userInfo: user ? JSON.parse(user) : null,
      localStorage: {
        skribble_token: !!localStorage.getItem('skribble_token'),
        token: !!localStorage.getItem('token'),
        skribble_user: !!localStorage.getItem('skribble_user')
      }
    });
  }, []);

  if (!authInfo) return null;

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white p-4 rounded text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Auth Debug Info:</h3>
      <div className="space-y-1">
        <div>Has Token: {authInfo.hasToken ? '✅' : '❌'}</div>
        <div>Token: {authInfo.tokenPreview}</div>
        <div>Has User: {authInfo.hasUser ? '✅' : '❌'}</div>
        <div>User: {authInfo.userInfo?.email || 'None'}</div>
        <div>LocalStorage Keys:</div>
        <div className="ml-2">
          {Object.entries(authInfo.localStorage).map(([key, value]) => (
            <div key={key}>{key}: {value ? '✅' : '❌'}</div>
          ))}
        </div>
      </div>
    </div>
  );
}