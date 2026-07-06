'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { isSupabaseConfigured } from '@/config/supabase';
import {
  Activity, Database, Shield, LogOut, Sun, Moon
} from 'lucide-react';

export default function Header() {
  const router = useRouter();
  const { adminUser, adminToken, clearAdminSession } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const activeTheme = storedTheme || systemTheme;
    setTheme(activeTheme);
    applyTheme(activeTheme);
  }, []);

  const applyTheme = (t: 'light' | 'dark') => {
    const root = window.document.documentElement;
    if (t === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
      root.classList.add('dark-theme-active');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
      root.classList.remove('dark-theme-active');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    router.push('/admin/login');
  };

  if (!isClient) {
    return (
      <header className="py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f1524]">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="text-xl font-bold text-blue-600">CivicLedger Admin</div>
          <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0f1524]/90 backdrop-blur-md">
      <div className="container mx-auto px-6 py-3.5 flex justify-between items-center gap-4">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:border-blue-500/40 shadow-sm transition-all duration-200">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100 font-sans group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">CivicLedger Admin</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black -mt-0.5">Control Center</span>
          </div>
        </Link>

        {/* Global Database Active Status Pills */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-xl">
          <Database className="h-3 w-3 text-blue-500" />
          <span>Active Registry:</span>
          <span className={isSupabaseConfigured() ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}>
            {isSupabaseConfigured() ? 'Supabase Database' : 'Local SQLite Fallback'}
          </span>
        </div>

        {/* Auth Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-404 transition-colors shadow-xs"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          {adminToken && adminUser ? (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 rounded-xl">
              <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold">Admin: {adminUser.name}</span>
              <button
                onClick={handleAdminLogout}
                className="text-slate-400 hover:text-red-500 ml-1.5 transition-colors"
                title="Logout Admin"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="http://localhost:3000/"
                className="text-xs text-slate-705 hover:text-blue-600 font-bold transition-colors bg-white hover:bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-400 px-3.5 py-2 rounded-xl"
              >
                Go to Voter Portal
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
