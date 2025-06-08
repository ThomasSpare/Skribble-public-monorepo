import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Skribble - Music Collaboration Platform',
  description: 'Where music meets collaboration. Professional annotation tools for producers and artists.',
  keywords: ['music', 'collaboration', 'audio', 'annotation', 'producer', 'artist', 'DAW'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
