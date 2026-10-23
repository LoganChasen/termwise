import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { loadAppData } from "@/server/mode";
import { Shell } from "@/ui/Shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Termwise",
  description: "Your whole semester in one place: assignments, workload heat map, grades, and what changed.",
};

export const dynamic = "force-dynamic";


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await loadAppData();
  // The theme choice lives in a cookie so the server renders it directly (no flash, no inline script).
  const theme = (await cookies()).get("tw-theme")?.value;
  const seen = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0;
  const updateCount = data.updates.filter((u) => new Date(u.at).getTime() > seen).length;
  return (
    <html lang="en" className={inter.variable} data-theme={theme === "dark" || theme === "light" ? theme : undefined} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Shell mode={data.mode} lastSyncAt={data.lastSyncAt} feedConnected={data.feedConnected} updateCount={updateCount}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
