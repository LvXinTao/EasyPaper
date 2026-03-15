import type { Metadata } from 'next';
import { Navbar } from '@/components/navbar';
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
      <body className="min-h-screen bg-slate-50">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
