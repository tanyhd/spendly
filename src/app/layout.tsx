import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import { THEME_INIT_SCRIPT } from '@/lib/themeScript';
import './globals.css';

const plexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-plex-mono',
    display: 'swap',
});

const plexSans = IBM_Plex_Sans({
    subsets: ['latin'],
    weight: ['400', '600', '700'],
    variable: '--font-plex-sans',
    display: 'swap',
});

// GA4 web stream "Spendly". Public by design (it ships in the page), so it lives in code
const GA_MEASUREMENT_ID = 'G-E1RQE1KKZH';

export const metadata: Metadata = {
    title: 'Spendly',
    description: 'Track your expenses and plan your budget.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        // data-theme is set by the inline script before hydration, so React must not flag the mismatch
        <html lang="en" className={`${plexMono.variable} ${plexSans.variable}`} data-theme="dark" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body>{children}</body>
            {/* Production builds only, so local development doesn't count as traffic */}
            {process.env.NODE_ENV === 'production' && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
        </html>
    );
}
