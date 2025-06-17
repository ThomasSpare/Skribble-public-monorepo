// frontend/src/utils/images.ts
export const getImageUrl = (imagePath: string | undefined): string => {
  if (!imagePath) return '';
  
  // Remove /api from the base URL for static assets
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';
  
  // Ensure imagePath starts with /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${cleanPath}`;
};

export const getDefaultAvatar = (username: string): string => {
  // Generate a consistent color based on username
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
  const colorIndex = username.length % colors.length;
  return colors[colorIndex];
};