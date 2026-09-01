import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Private Client Tax Planning Simulator',
    template: '%s · Private Client Tax Planning Simulator',
  },
  description:
    'An educational analytical model for private client tax research, scenario comparison and deliverable preparation. Synthetic client data only. Not tax, legal or financial advice.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
