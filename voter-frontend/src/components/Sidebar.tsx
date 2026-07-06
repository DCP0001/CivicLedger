'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { 
  LayoutDashboard, Vote, BarChart3, User, 
  ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { voterToken } = useAuthStore();

  const isVoter = !!voterToken;

  const voterItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'My Elections', icon: Vote, path: '/' },
    { label: 'Results Ledger', icon: BarChart3, path: '/verify' },
    { label: 'Profile', icon: User, path: '/profile' },
  ];

  if (!isVoter) {
    return null; // Don't show sidebar for anonymous landing page users
  }

  return (
    <aside 
      className={`hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1524] h-[calc(100vh-73px)] sticky top-[73px] transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Items */}
      <div className="flex-1 py-6 px-4 space-y-7 overflow-y-auto">
        <div>
          <span className={`text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-3 px-3 transition-opacity ${
            collapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'
          }`}>
            Voter Panel
          </span>
          <nav className="space-y-1">
            {voterItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={idx}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-450 dark:hover:text-slate-250 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-650 dark:group-hover:text-slate-350'}`} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Collapse Toggle Footer Button */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
