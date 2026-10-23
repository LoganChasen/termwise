import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { loadAppData } from "@/server/mode";
import { Shell } from "@/ui/Shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Termwise",
  description: "Your whole semester in one place: assignments, workload heat map, grades, and what changed.",
};

export const dynamic = "force-dynamic";

// Applies the saved theme before paint so there's no light/dark flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("tw-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await loadAppData();
  const seen = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0;
  const updateCount = data.updates.filter((u) => new Date(u.at).getTime() > seen).length;
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Shell mode={data.mode} lastSyncAt={data.lastSyncAt} feedConnected={data.feedConnected} updateCount={updateCount}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
