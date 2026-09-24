import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "You&Me — Build the team behind your startup", template: "%s · You&Me" },
  description:
    "Find cofounders, consultants, advisors, and startup talent — intelligently matched to what you're building.",
  applicationName: "You&Me",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

// Applies the saved/system theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('ym-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-foreground">
          Skip to content
        </a>
        {children}
        <Toaster position="top-center" toastOptions={{ classNames: { toast: "!rounded-[14px] !border-border !bg-elevated !text-foreground !shadow-float" } }} />
      </body>
    </html>
  );
}
