import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import './globals.css';

const hanken = Hanken_Grotesk({
    subsets: ['latin'],
    variable: '--font-hanken',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Spendly',
    description: 'Track your expenses and plan your budget.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={hanken.variable}>
            <body>{children}</body>
        </html>
    );
}
