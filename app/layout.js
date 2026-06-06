import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'PBM Client Dashboard',
  description: 'Pricing By Mira — Client Performance Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0f0f1a] text-slate-200`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
