'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { SECURE_VOTE_ABI, SECURE_VOTE_ADDRESS } from '@/config/contract';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import { 
  User, Mail, Wallet, ShieldCheck, CheckCircle2, AlertCircle, Clock, Vote, ArrowRight, Loader2, Database
} from 'lucide-react';

interface Election {
  id: number;
  title: string;
  description: string;
  status: string;
}

interface ElectionStatusRowProps {
  election: Election;
  walletAddress: string;
}

function ElectionStatusRow({ election, walletAddress }: ElectionStatusRowProps) {
  // Read on-chain registration state
  const { data: isWhitelisted, isLoading: loadingWhitelist } = useReadContract({
    address: SECURE_VOTE_ADDRESS,
    abi: SECURE_VOTE_ABI,
    functionName: 'isRegistered',
    args: [BigInt(election.id), walletAddress as `0x${string}`],
  });

  // Read on-chain has-voted state
  const { data: hasVoted, isLoading: loadingVoted } = useReadContract({
    address: SECURE_VOTE_ADDRESS,
    abi: SECURE_VOTE_ABI,
    functionName: 'hasVoted',
    args: [BigInt(election.id), walletAddress as `0x${string}`],
  });

  const loading = loadingWhitelist || loadingVoted;

  return (
    <div className="p-5 bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-250 leading-snug">{election.title}</h4>
        <p className="text-[11px] text-slate-550 dark:text-slate-400 line-clamp-1">{election.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {loading ? (
          <span className="text-[10px] text-slate-450 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Querying contract...
          </span>
        ) : (
          <>
            {/* Whitelist Status */}
            {isWhitelisted ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Whitelisted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-150 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30">
                <Clock className="h-3.5 w-3.5" /> Pending Verification
              </span>
            )}

            {/* Voting Action */}
            {hasVoted ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-150 dark:bg-blue-950/20 dark:text-blue-405 dark:border-blue-900/30">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ballot Cast
              </span>
            ) : isWhitelisted && election.status.toLowerCase() === 'active' ? (
              <Link
                href={`/elections/${election.id}/vote`}
                className="btn-premium flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-lg shadow-xs"
              >
                Go Vote <ArrowRight className="h-3 w-3" />
              </Link>
            ) : isWhitelisted ? (
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                Voting Closed/Upcoming
              </span>
            ) : (
              <span className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-800 px-2.5 py-1 rounded-lg">
                Ask Admin to Whitelist Wallet
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function VoterProfile() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { voterUser, voterToken } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbSource, setDbSource] = useState<'Supabase Cloud' | 'SQLite Fallback'>('SQLite Fallback');

  useEffect(() => {
    fetchProfileAndElections();
  }, [connectedAddress, voterUser]);

  const fetchProfileAndElections = async () => {
    setLoading(true);
    const lookupAddress = connectedAddress || voterUser?.walletAddress;
    
    if (!lookupAddress) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Profile Info
      let userProfile = null;
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('voters')
          .select('*')
          .eq('wallet_address', lookupAddress.toLowerCase())
          .single();

        if (!error && data) {
          userProfile = {
            name: data.name,
            email: data.email,
            walletAddress: data.wallet_address,
          };
          setDbSource('Supabase Cloud');
        } else if (error && !isTableMissing(error)) {
          console.warn('Supabase profile fetch error:', error);
        }
      }

      if (!userProfile) {
        const response = await fetch(`http://localhost:5000/api/voters/check/${lookupAddress}`);
        if (response.ok) {
          const data = await response.json();
          if (data.registered) {
            userProfile = data.user;
            setDbSource('SQLite Fallback');
          }
        }
      }
      setProfile(userProfile);

      // 2. Fetch Elections
      let electionsData = [];
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('elections')
          .select('id, title, description, status')
          .order('id', { ascending: true });
        
        if (!error) {
          electionsData = data || [];
        }
      }

      if (electionsData.length === 0) {
        const response = await fetch('http://localhost:5000/api/elections');
        if (response.ok) {
          electionsData = await response.json();
        }
      }
      setElections(electionsData);

    } catch (err) {
      console.error('Error fetching profile dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Resolving your voter credentials profile...</p>
      </div>
    );
  }

  // Not Connected State
  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center space-y-6">
        <div className="saas-card p-8 space-y-5">
          <Wallet className="h-12 w-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Connect Wallet to Check Status</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed max-w-sm mx-auto">
            Please connect your Ethereum wallet in the top header menu to query your verification status and active credentials.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/register" className="btn-premium-outline text-xs font-bold px-4 py-2 rounded-xl">
              Register New Profile
            </Link>
            <Link href="/" className="btn-premium text-xs font-bold px-4 py-2 rounded-xl">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Connected but Not Registered Profile State
  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center space-y-6">
        <div className="saas-card p-8 space-y-5 border-amber-300 dark:border-amber-900/50 bg-amber-50/5 dark:bg-amber-950/5">
          <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Voter Profile Not Registered</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed max-w-sm mx-auto">
            Your connected wallet address <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 border dark:border-slate-800 text-[10.5px]">{connectedAddress?.slice(0, 8)}...{connectedAddress?.slice(-4)}</code> is not registered in the Voters Directory.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/register" className="btn-premium text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs">
              Self-Register Now
            </Link>
            <Link href="/" className="btn-premium-outline text-xs font-bold px-5 py-2.5 rounded-xl">
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header Title */}
      <div className="text-center md:text-left border-b border-slate-200 dark:border-slate-800 pb-5 space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">Voter Account Dashboard</h1>
        <p className="text-xs text-slate-500 dark:text-slate-450">Track your verified voting profile parameters and smart contract white-list status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Profile Summary Info Card */}
        <div className="md:col-span-1">
          <div className="saas-card p-6 space-y-5 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <User className="h-4.5 w-4.5 text-blue-500" />
                Voter Profile
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Full Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">{profile.name}</span>
                </div>
                <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Email Address</span>
                  <span className="text-slate-600 dark:text-slate-350 block flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {profile.email}</span>
                </div>
                <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Wallet Address</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-350 block flex items-center gap-1.5 select-all truncate"><Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {profile.walletAddress}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Database className="h-3 w-3" /> Sync Registry:</span>
              <span className="text-blue-600 dark:text-blue-450">{dbSource}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Elections Verification Status List */}
        <div className="md:col-span-2">
          <div className="saas-card p-6 space-y-6 h-full">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Vote className="h-4.5 w-4.5 text-blue-500" />
              Eligible Elections & Whitelist Status
            </h3>

            {elections.length === 0 ? (
              <p className="text-xs text-slate-450 text-center py-10">No public elections configured yet.</p>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {elections.map((election) => (
                  <ElectionStatusRow 
                    key={election.id} 
                    election={election} 
                    walletAddress={profile.walletAddress}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
