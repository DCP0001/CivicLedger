'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import { recoverMessageAddress } from 'viem';
import {
  Wallet, LogIn, AlertCircle, Loader2, ShieldCheck, ChevronRight,
  Activity, UserCheck, ArrowRight
} from 'lucide-react';

export default function VoterLogin() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { setVoterSession, voterToken } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (voterToken) {
      router.push('/profile');
    }
  }, [voterToken, router]);

  const metamaskConnector = isClient
    ? connectors.find((c) => c.id === 'metaMask') || connectors[0]
    : null;

  const handleSign = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const message = `Sign this message to authenticate your wallet at Secure Vote.\nTimestamp: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      // Try Supabase first
      if (isSupabaseConfigured()) {
        const recovered = await recoverMessageAddress({ message, signature });
        if (recovered.toLowerCase() !== address.toLowerCase()) {
          throw new Error('Signature mismatch — please try again.');
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
          router.push('/profile');
          return;
        } else if (voterErr && !isTableMissing(voterErr)) {
          throw new Error('Could not find your account: ' + voterErr.message);
        }
      }

      // Fallback to local backend
      const response = await fetch('http://localhost:5000/api/auth/login/voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, signature, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Make sure your wallet is registered.');
      }

      setVoterSession(data.token, {
        ...data.user,
        verificationStatus: data.user.verificationStatus || 'pending',
        verificationNotes: data.user.verificationNotes || null,
      });

      router.push('/profile');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
      disconnect();
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10">
      <div className="w-full max-w-md space-y-6 fade-slide-in">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Activity className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Voter Login
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Connect your Ethereum wallet to access your voter dashboard and check your verification status.
          </p>
        </div>

        {/* Main Card */}
        <div className="saas-card p-8 space-y-6">

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 p-4 rounded-xl text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!isConnected ? (
            /* Step 1: Connect Wallet */
            <div className="space-y-5">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto">
                  <Wallet className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Step 1: Connect your wallet</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Use the same wallet address you registered with.
                </p>
              </div>

              <button
                onClick={() => metamaskConnector && connect({ connector: metamaskConnector })}
                className="btn-premium w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl"
              >
                <Wallet className="h-4 w-4" />
                Connect MetaMask
              </button>

              {/* How it works */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">How it works</p>
                {[
                  'Connect your registered Ethereum wallet',
                  'Sign a one-time security message',
                  'View your verification status instantly',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300">
                    <span className="h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Sign & Authenticate */
            <div className="space-y-5">
              {/* Connected wallet display */}
              <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Wallet Connected</p>
                  <p className="font-mono text-xs text-emerald-800 dark:text-emerald-300 truncate">{address}</p>
                </div>
              </div>

              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Step 2: Sign to verify identity</p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  This signature proves you own this wallet. It does not cost any gas.
                </p>
              </div>

              <button
                onClick={handleSign}
                disabled={loading}
                className="btn-premium w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><LogIn className="h-4 w-4" /> Sign & Login</>
                )}
              </button>

              <button
                onClick={() => { disconnect(); setError(null); }}
                className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Use a different wallet
              </button>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3">
          <p className="text-xs text-slate-500">
            Not registered yet?{' '}
            <Link href="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              Register to Vote <ArrowRight className="inline h-3 w-3" />
            </Link>
          </p>
          <p className="text-[11px] text-slate-400">
            Admin?{' '}
            <Link href="/admin/login" className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors">
              Go to Admin Portal
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
