import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Spendly',
    description: 'Track your expenses and plan your budget.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
