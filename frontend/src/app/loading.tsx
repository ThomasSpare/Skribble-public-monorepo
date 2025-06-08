export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-skribble flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <h1 className="font-madimi text-3xl text-skribble-sky">Skribble</h1>
          <div className="absolute -top-3 -right-3 bg-skribble-azure rounded-xl rounded-bl-sm px-2 py-1 animate-bounce-gentle">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
        
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="text-skribble-azure">Loading your creative space...</p>
      </div>
    </div>
  )
}