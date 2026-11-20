import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineRegistration } from '@/components/offline-registration';

// Fredoka (variable, self-hosted OFL) for figures and titles; Figtree (variable, self-hosted OFL) for body copy.
const fredoka = localFont({
  src: "./fonts/Fredoka-Variable.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  display: "swap",
});

const figtree = localFont({
  src: "./fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ez-life",
  description: "Control financiero personal",
  openGraph: {
    title: "ez-life",
    description: "Control financiero personal",
    siteName: "ez-life",
    locale: "es",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ez-life",
    description: "Control financiero personal",
  },
};

// `viewportFit: "cover"` makes `env(safe-area-inset-bottom)` real on notched devices.
// Theme colors match warm cream (light) and deep plum (dark).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF5EA" },
    { media: "(prefers-color-scheme: dark)", color: "#241A2B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("font-sans", fredoka.variable, figtree.variable)}
    >
      <body className={cn("antialiased min-h-screen bg-background font-sans", fredoka.variable, figtree.variable)}>
        <OfflineRegistration />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
