import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Content Engine V2',
  description: 'Content automation platform for portfolio sites',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-8">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="text-[#2563EB] font-bold text-lg">Content Engine</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">v2</span>
                  </Link>
                  <div className="flex gap-6">
                    <Link
                      href="/"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/drafts"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Drafts
                    </Link>
                    <Link
                      href="/pipeline"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Pipeline
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
