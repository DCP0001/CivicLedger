'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Mail, Lock, ShieldAlert, ArrowRight, Wallet } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import { recoverMessageAddress } from 'viem';

export default function AdminLogin() {
  const router = useRouter();
  const { setAdminSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const handleWalletAdminLogin = async () => {
    if (!address) {
      setError('Please connect your admin wallet first.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const message = `Sign this message to authenticate your administrator session at Secure Vote.\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      if (isSupabaseConfigured()) {
        const recovered = await recoverMessageAddress({ message, signature });
        if (recovered.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Signature verification failed. Address mismatch.');
        }

        // Query Supabase voters/profiles for admin role
        const { data: adminRecord, error: adminErr } = await supabase!
          .from('voters')
          .select('*')
          .eq('wallet_address', address.toLowerCase())
          .eq('role', 'admin')
          .single();

        if (!adminErr && adminRecord) {
          setAdminSession('supabase-admin-token', {
            id: adminRecord.id,
            name: adminRecord.name,
            email: adminRecord.email,
            role: adminRecord.role,
            walletAddress: adminRecord.wallet_address
          });
          router.push('/admin/dashboard');
          return;
        } else if (adminErr && !isTableMissing(adminErr)) {
          throw new Error('Admin verification query failed: ' + adminErr.message);
        } else {
          // Table missing or other, fall back to checking hardcoded admin account details
          if (address.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.toLowerCase()) {
            setAdminSession('local-admin-token-bypass', {
              id: 'local-admin-id',
              name: 'System Admin (Dev)',
              email: 'admin@securevote.com',
              role: 'admin',
              walletAddress: address
            });
            router.push('/admin/dashboard');
            return;
          }
          throw new Error('This wallet is not registered as an administrator in the database.');
        }
      }

      // SQLite Local Fallback checks
      if (address.toLowerCase() === '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'.toLowerCase()) {
        setAdminSession('local-admin-token-bypass', {
          id: 'local-admin-id',
          name: 'System Admin (Dev)',
          email: 'admin@securevote.com',
          role: 'admin',
          walletAddress: address
        });
        router.push('/admin/dashboard');
      } else {
        throw new Error('Wallet connection dev-bypass is only enabled for Hardhat Account #0 (0xf39f...).');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Signature login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setAdminSession(data.token, data.user);
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 md:py-20">
      <div className="glass-panel p-8 rounded-3xl space-y-6 shadow-xl border-indigo-500/10">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-2 animate-pulse">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-150">Administrator Portal</h1>
          <p className="text-xs text-gray-404">Sign in using your password credentials or verified wallet</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-3.5 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {isConnected && (
          <button
            onClick={handleWalletAdminLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 font-bold text-xs py-3 rounded-xl transition-all shadow-inner active:scale-97"
          >
            <Wallet className="h-4 w-4" />
            {loading ? 'Authorizing...' : 'Sign In with Admin Wallet'}
          </button>
        )}

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-white/5 flex-1" />
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">or credentials</span>
          <div className="h-px bg-white/5 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@securevote.com"
                className="w-full input-premium focus:border-indigo-500/50 outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-200 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full input-premium focus:border-indigo-500/50 outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-200 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-premium w-full text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In with Password'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[10px] text-gray-500 border-t border-white/5 pt-4">
            Default credentials: <span className="font-mono text-gray-400">admin@securevote.com</span> / <span className="font-mono text-gray-400">adminpassword123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
