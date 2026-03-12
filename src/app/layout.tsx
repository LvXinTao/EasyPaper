import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyPaper - AI Paper Reader',
  description: 'Upload and understand academic papers with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-gray-800">
              EasyPaper
            </a>
            <a
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Settings
            </a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
