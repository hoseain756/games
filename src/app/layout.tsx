import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Tajawal } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ensureGameEngines } from "@/lib/engine-host";

// The two real-time engines (letters 3004, questions 3003) live inside this
// persistent Next.js server process. Idempotent: the globalThis guard plus
// EADDRINUSE tolerance make repeated calls no-ops (src/instrumentation.ts
// covers fresh boots; this covers the already-running dev server).
if (typeof window === "undefined") {
  ensureGameEngines();
}

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "الألعاب الجماعية — لعبة الصور وحروف مع حسين",
  description:
    "منصة ألعاب جماعية عبر الجوالات: لعبة الصور والأسئلة بـ QR، ولعبة حروف مع حسين بخلايا سداسية وفريقين وزر ضخم وأسرع إجابة.",
  keywords: ["لعبة أسئلة", "QR", "ألعاب جماعية", "party game"],
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#140c06" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${tajawal.variable} ${baloo.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
