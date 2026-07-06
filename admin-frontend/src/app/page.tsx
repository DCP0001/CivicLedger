'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { adminToken } = useAuthStore();

  useEffect(() => {
    if (adminToken) {
      router.push('/admin/dashboard');
    } else {
      router.push('/admin/login');
    }
  }, [adminToken, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-slate-500 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium">Redirecting to Admin Portal...</p>
    </div>
  );
}
