import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CivicLedger | SaaS E-Voting Platform",
  description: "A secure, transparent, and accessible blockchain-based voting application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors">
            <Header />
            <div className="flex flex-row flex-1">
              <Sidebar />
              <main className="flex-1 max-w-7xl mx-auto px-6 py-8 md:px-8">
                <div className="fade-slide-in">
                  {children}
                </div>
              </main>
            </div>
            <footer className="py-6 text-center text-xs text-slate-400 dark:text-slate-550 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f1524]/30">
              <p>© {new Date().getFullYear()} CivicLedger platform. Built on secure Ethereum smart contracts.</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
