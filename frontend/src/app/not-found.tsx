import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-skribble flex items-center justify-center px-6">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <h1 className="font-madimi text-4xl text-skribble-sky mb-4">404</h1>
          <div className="absolute -top-3 -right-3 bg-skribble-azure rounded-xl rounded-bl-sm px-2 py-1 animate-float">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-madimi text-skribble-azure mb-4">Page Not Found</h2>
        <p className="text-skribble-sky mb-8 max-w-md mx-auto">
          Looks like this track got lost in the mix! Lets get you back to the main session.
        </p>
        
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 bg-gradient-primary text-white px-6 py-3 rounded-full hover:shadow-lg hover:shadow-skribble-azure/25 transition-all duration-300 hover:scale-105"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
