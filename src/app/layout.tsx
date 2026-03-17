import type { Metadata } from 'next';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyPaper - AI Paper Reader',
  description: 'Upload and understand academic papers with AI',
};

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('easypaper-theme');
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    var accent = localStorage.getItem('easypaper-accent');
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      var r = parseInt(accent.slice(1, 3), 16);
      var g = parseInt(accent.slice(3, 5), 16);
      var b = parseInt(accent.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-subtle', 'rgba(' + r + ',' + g + ',' + b + ',0.1)');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
