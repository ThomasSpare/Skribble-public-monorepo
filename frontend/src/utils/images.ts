// frontend/src/utils/images.ts
export const getImageUrl = (imagePath: string | undefined): string => {
  if (!imagePath) return '';
  
  // Check if the imagePath is already a full URL (S3 or external)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // For relative paths (legacy Railway storage), construct full URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';
  
  // Ensure imagePath starts with /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${cleanPath}`;
};

export const getDefaultAvatar = (username: string): string => {
  // Generate a consistent color based on username
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-orange-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-yellow-500', 'bg-gray-500', 'bg-rose-500', 'bg-emerald-500'
  ];
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), username.length);
  const colorIndex = hash % colors.length;
  
  return colors[colorIndex];
};