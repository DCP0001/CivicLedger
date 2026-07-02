'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useState, useEffect } from 'react';
import { Wallet, LogOut, Shield, UserCheck, Activity, Database, Clock, XCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import { recoverMessageAddress } from 'viem';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const {
    adminToken,
    adminUser,
    voterToken,
    voterUser,
    setVoterSession,
    clearVoterSession,
    clearAdminSession,
  } = useAuthStore();

  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle wallet signature authentication
  const handleVoterAuth = async () => {
    if (!address) return;
    setLoading(true);
    setAuthError(null);

    try {
      const timestamp = Date.now();
      const message = `Sign this message to authenticate your wallet at Secure Vote.\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      if (isSupabaseConfigured()) {
        const recovered = await recoverMessageAddress({ message, signature });
        if (recovered.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Signature recovered address does not match active wallet');
        }

        const { data: voter, error: voterErr } = await supabase!
          .from('voters')
          .select('*')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (!voterErr && voter) {
          setVoterSession('supabase-voter-token', {
            id: voter.id,
            name: voter.name,
            email: voter.email,
            role: voter.role,
            walletAddress: voter.wallet_address,
            verificationStatus: voter.verification_status || 'pending',
            verificationNotes: voter.verification_notes || null,
          });
          router.refresh();
          setLoading(false);
          return;
        } else if (voterErr && !isTableMissing(voterErr)) {
          throw new Error('Supabase voter check failed: ' + voterErr.message);
        }
      }

      const response = await fetch('http://localhost:5000/api/auth/login/voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setVoterSession(data.token, {
        ...data.user,
        verificationStatus: data.user.verificationStatus || 'pending',
        verificationNotes: data.user.verificationNotes || null,
      });
      router.refresh();
    } catch (error: any) {
      console.error('Voter auth error:', error);
      setAuthError(error.message || 'Signature verification failed');
      disconnect();
    } finally {
      setLoading(false);
    }
  };

  // Synchronize Zustand voter session when account changes
  useEffect(() => {
    if (isClient) {
      if (!isConnected || !address) {
        if (voterToken) clearVoterSession();
      } else if (voterUser && voterUser.walletAddress.toLowerCase() !== address.toLowerCase()) {
        clearVoterSession();
      }
    }
  }, [address, isConnected, isClient]);

  const handleDisconnect = () => {
    disconnect();
    clearVoterSession();
    router.push('/');
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    router.push('/');
  };

  const getVerificationBadge = () => {
    if (!voterUser) return null;
    const status = voterUser.verificationStatus;

    if (status === 'verified') {
      return (
        <Link href="/profile" className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400 hover:opacity-80 transition-opacity">
          <UserCheck className="h-2.5 w-2.5" /> Verified
        </Link>
      );
    }
    if (status === 'rejected') {
      return (
        <Link href="/profile" className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 hover:opacity-80 transition-opacity">
          <XCircle className="h-2.5 w-2.5" /> Rejected
        </Link>
      );
    }
    return (
      <Link href="/profile" className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 hover:opacity-80 transition-opacity">
        <Clock className="h-2.5 w-2.5" /> Pending
      </Link>
    );
  };

  if (!isClient) {
    return (
      <header className="py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f1524]">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="text-xl font-bold text-blue-600">CivicLedger</div>
          <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </header>
    );
  }

  // metaMask() is first connector in wagmi config — use connectors[0] as the reliable pick
  const metamaskConnector = connectors[0];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0f1524]/90 backdrop-blur-md">
      <div className="container mx-auto px-6 py-3.5 flex justify-between items-center gap-4">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:border-blue-500/40 shadow-sm transition-all duration-200">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100 font-sans group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">CivicLedger</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black -mt-0.5">SaaS E-Voting</span>
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

        {/* Wallet & Auth Controls */}
        <div className="flex items-center gap-3">
          {/* Admin status pill */}
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
                href="/register"
                className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors bg-blue-50 hover:bg-blue-100/70 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400 px-3.5 py-2 rounded-xl"
              >
                Register to Vote
              </Link>
              <Link
                href="/login"
                className="text-xs text-slate-700 hover:text-blue-600 font-bold transition-colors bg-white hover:bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300 dark:hover:text-blue-400 px-3.5 py-2 rounded-xl"
              >
                Voter Login
              </Link>
              <Link
                href="/admin/login"
                className="text-xs text-slate-500 hover:text-blue-600 font-semibold transition-colors bg-slate-50 hover:bg-slate-100 border border-slate-200/60 dark:bg-slate-800/35 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 px-3 py-2 rounded-xl"
              >
                Admin Portal
              </Link>
            </div>
          )}

          {/* Wallet connection state */}
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              {voterToken && voterUser ? (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1.5 rounded-xl text-emerald-650 dark:text-emerald-400 font-semibold text-xs">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{voterUser.name}</span>
                  {getVerificationBadge()}
                </div>
              ) : (
                <button
                  onClick={handleVoterAuth}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign Signature to Auth'}
                </button>
              )}

              <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0c101d] border border-slate-200/60 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-mono text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded">
                  Localhost
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded ${
                  isSupabaseConfigured()
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {isSupabaseConfigured() ? 'Supabase' : 'SQLite'}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-slate-450 hover:text-red-500 ml-1.5 transition-colors"
                  title="Disconnect Wallet"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 px-3 py-2 rounded-xl">
                <span className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured() ? 'bg-blue-500' : 'bg-slate-400'}`} />
                <span>DB: {isSupabaseConfigured() ? 'Supabase Cloud' : 'Local SQLite'}</span>
              </div>
              <button
                onClick={() => metamaskConnector && connect({ connector: metamaskConnector })}
                disabled={!metamaskConnector}
                className="btn-premium flex items-center gap-2 text-white text-xs font-bold px-4.5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <Wallet className="h-3.5 w-3.5" />
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
      {authError && (
        <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/30 text-center py-2 text-xs text-red-600 dark:text-red-400 font-medium">
          Error: {authError}
        </div>
      )}
    </header>
  );
}
