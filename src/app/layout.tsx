import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineRegistration } from '@/components/offline-registration';

// Geist (variable, self-hosted) for text; JetBrains Mono for micro-labels, hotkeys and metadata.
const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
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

// `viewportFit: "cover"` makes `env(safe-area-inset-bottom)` real on notched devices, which the
// bottom navigation uses as padding. Theme colors match `--background` (dark default / light).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090A0F" },
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
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
      className={cn("font-sans", geist.variable, jetbrainsMono.variable)}
    >
      <body className="antialiased min-h-screen bg-background">
        <OfflineRegistration />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
