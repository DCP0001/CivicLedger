'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { SECURE_VOTE_ABI, SECURE_VOTE_ADDRESS } from '@/config/contract';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import {
  User, Mail, Wallet, ShieldCheck, CheckCircle2, AlertCircle, Clock, Vote, ArrowRight,
  Loader2, Database, RefreshCw, XCircle, MessageSquare, ChevronRight, BadgeCheck,
  CalendarDays, Shield
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface Election {
  id: number;
  title: string;
  description: string;
  status: string;
}

interface VoterProfile {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
}

// ─── Progress Steps ───────────────────────────────────────────────────────────

function ProgressTimeline({ status }: { status: VerificationStatus }) {
  const steps = [
    { label: 'Registration Submitted', done: true },
    { label: 'Verification in Progress', done: status !== 'pending', active: status === 'pending' },
    {
      label: status === 'rejected' ? 'Verification Rejected' : 'Approved',
      done: status === 'verified',
      rejected: status === 'rejected',
    },
    { label: 'Eligible to Vote', done: status === 'verified' },
  ];

  return (
    <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all
            ${step.done ? 'bg-emerald-500 border-emerald-500 text-white' :
              step.rejected ? 'bg-red-500 border-red-500 text-white' :
              step.active ? 'bg-amber-400 border-amber-400 text-white animate-pulse' :
              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
            {step.done ? '✓' : step.rejected ? '✗' : i + 1}
          </div>
          <span className={`text-xs font-medium
            ${step.done ? 'text-emerald-700 dark:text-emerald-400' :
              step.rejected ? 'text-red-600 dark:text-red-400' :
              step.active ? 'text-amber-700 dark:text-amber-400 font-bold' :
              'text-slate-400 dark:text-slate-600'}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Election Status Row (only shown when verified) ───────────────────────────

function ElectionStatusRow({ election, walletAddress }: { election: Election; walletAddress: string }) {
  const { data: isWhitelisted, isLoading: loadingWhitelist } = useReadContract({
    address: SECURE_VOTE_ADDRESS,
    abi: SECURE_VOTE_ABI,
    functionName: 'isRegistered',
    args: [BigInt(election.id), walletAddress as `0x${string}`],
  });

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
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">{election.title}</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{election.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {loading ? (
          <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Querying...
          </span>
        ) : (
          <>
            {isWhitelisted ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Whitelisted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
                <Clock className="h-3.5 w-3.5" /> Pending Whitelist
              </span>
            )}
            {hasVoted ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">
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
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                {election.status === 'ended' ? 'Voting Closed' : 'Upcoming'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-800 px-2.5 py-1 rounded-lg">
                Ask Admin to Whitelist
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pending View ─────────────────────────────────────────────────────────────

function PendingView({ profile, onRefresh, refreshing }: { profile: VoterProfile; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Card */}
      <div className="saas-card p-8 text-center space-y-6">
        {/* Animated Illustration */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-amber-100 dark:bg-amber-950/30 animate-pulse" />
          <div className="relative h-full w-full flex items-center justify-center">
            <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="36" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
              <path d="M40 22v20l10 6" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="40" cy="40" r="2" fill="#F59E0B" />
            </svg>
          </div>
        </div>

        {/* Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 text-xs font-bold">
            <Clock className="h-3.5 w-3.5" />
            Pending Review
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Verification Pending</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            Your registration has been submitted successfully. Your account is currently under review by the election authority.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 italic max-w-md mx-auto">
            Verification is typically completed within 7 days. If your application is still pending after this period, please contact the election authority.
          </p>
        </div>

        <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl py-3 px-5 text-blue-700 dark:text-blue-400">
          You will receive access to eligible elections immediately after your account is approved.
        </p>

        {/* Progress Timeline */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Registration Progress</p>
          <ProgressTimeline status="pending" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-premium flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking...' : 'Refresh Status'}
          </button>
          <a
            href="mailto:admin@securevote.com"
            className="btn-premium-outline flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
          >
            <MessageSquare className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>

      {/* Registration Details */}
      <div className="saas-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <User className="h-4 w-4 text-blue-500" /> Your Registration Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Full Name</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{profile.name}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email Address</span>
            <p className="text-slate-600 dark:text-slate-350 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{profile.email}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Wallet Address</span>
            <p className="font-mono text-[11px] text-slate-600 dark:text-slate-350 flex items-center gap-1.5 select-all"><Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" />{profile.walletAddress}</p>
          </div>
          {profile.createdAt && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Submitted On</span>
              <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rejected View ────────────────────────────────────────────────────────────

function RejectedView({ profile, onRefresh, refreshing }: { profile: VoterProfile; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="saas-card p-8 text-center space-y-6 border-red-200 dark:border-red-900/40">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-950/30" />
          <div className="relative h-full w-full flex items-center justify-center">
            <XCircle className="h-14 w-14 text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 text-xs font-bold">
            <XCircle className="h-3.5 w-3.5" />
            Verification Unsuccessful
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Verification Unsuccessful</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            Your registration could not be verified by the election authority. If you believe this is an error, please contact the election administrator.
          </p>
        </div>

        {/* Rejection Notes */}
        {profile.verificationNotes && (
          <div className="text-left bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl p-4 space-y-2">
            <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Review Notes from Administrator</p>
            <p className="text-sm text-red-800 dark:text-red-300 italic">"{profile.verificationNotes}"</p>
          </div>
        )}

        {/* Progress Timeline */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Registration Status</p>
          <ProgressTimeline status="rejected" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <a
            href="mailto:admin@securevote.com"
            className="btn-premium flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl"
          >
            <MessageSquare className="h-4 w-4" />
            Contact Support
          </a>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-premium-outline flex items-center justify-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Verified View ────────────────────────────────────────────────────────────

function VerifiedView({
  profile,
  elections,
  dbSource,
}: {
  profile: VoterProfile;
  elections: Election[];
  dbSource: string;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Welcome, {profile.name.split(' ')[0]}
            </h1>
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Voter
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Your account is approved. You can now participate in eligible elections.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/elections" className="btn-premium text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5">
            <Vote className="h-3.5 w-3.5" /> View Elections
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Profile Summary Card */}
        <div className="md:col-span-1">
          <div className="saas-card p-6 space-y-5 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <User className="h-4 w-4 text-blue-500" /> Voter Profile
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Full Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block">{profile.name}</span>
                </div>
                <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Email Address</span>
                  <span className="text-slate-600 dark:text-slate-350 flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {profile.email}</span>
                </div>
                <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Wallet Address</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-350 flex items-center gap-1.5 select-all truncate"><Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {profile.walletAddress}</span>
                </div>
                {profile.verifiedAt && (
                  <div className="space-y-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Verified On</span>
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {new Date(profile.verifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Elections', href: '/elections', icon: Vote },
                  { label: 'Results', href: '/elections', icon: CheckCircle2 },
                  { label: 'Verify Ballot', href: '/verify', icon: Shield },
                  { label: 'Profile', href: '/profile', icon: User },
                ].map(({ label, href, icon: Icon }) => (
                  <Link key={label} href={href} className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
                    <Icon className="h-3 w-3" /> {label}
                  </Link>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1"><Database className="h-3 w-3" /> Registry:</span>
                <span className="text-blue-600 dark:text-blue-450">{dbSource}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Elections List */}
        <div className="md:col-span-2">
          <div className="saas-card p-6 space-y-6 h-full">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Vote className="h-4 w-4 text-blue-500" />
              Eligible Elections & Whitelist Status
            </h3>

            {elections.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Vote className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No eligible elections at this time.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                  You will automatically see new elections when they become available to you.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoterProfile() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { voterUser, voterToken, updateVoterVerificationStatus } = useAuthStore();

  const [profile, setProfile] = useState<VoterProfile | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbSource, setDbSource] = useState<'Supabase Cloud' | 'SQLite Fallback'>('SQLite Fallback');

  const fetchProfileAndElections = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const lookupAddress = connectedAddress || voterUser?.walletAddress;
    if (!lookupAddress) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // 1. Fetch Profile Info
      let userProfile: VoterProfile | null = null;

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('voters')
          .select('*')
          .eq('wallet_address', lookupAddress.toLowerCase())
          .single();

        if (!error && data) {
          userProfile = {
            id: data.id,
            name: data.name,
            email: data.email,
            walletAddress: data.wallet_address,
            verificationStatus: data.verification_status || 'pending',
            verificationNotes: data.verification_notes || null,
            verifiedAt: data.verified_at || null,
            createdAt: data.created_at,
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

      // Sync verification status into global store
      if (userProfile && updateVoterVerificationStatus) {
        updateVoterVerificationStatus(userProfile.verificationStatus, userProfile.verificationNotes);
      }

      // 2. Fetch Elections (only really needed for verified users but pre-fetch)
      let electionsData: Election[] = [];
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('elections')
          .select('id, title, description, status')
          .order('id', { ascending: true });
        if (!error) electionsData = data || [];
      }

      if (electionsData.length === 0) {
        const response = await fetch('http://localhost:5000/api/elections');
        if (response.ok) electionsData = await response.json();
      }
      setElections(electionsData);
    } catch (err) {
      console.error('Error fetching profile dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connectedAddress, voterUser]);

  useEffect(() => {
    fetchProfileAndElections();
  }, [fetchProfileAndElections]);

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Loading your voter profile...</p>
      </div>
    );
  }

  // ── Not Connected State ────────────────────────────────────────────────────

  if (!isConnected && !voterUser) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center space-y-6">
        <div className="saas-card p-8 space-y-5">
          <Wallet className="h-12 w-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Connect Wallet to Check Status</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Please connect your Ethereum wallet to query your verification status and access your voter dashboard.
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

  // ── Not Registered State ───────────────────────────────────────────────────

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center space-y-6">
        <div className="saas-card p-8 space-y-5 border-amber-300 dark:border-amber-900/50">
          <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Voter Profile Not Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Your wallet <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 border dark:border-slate-800 text-[10.5px]">{connectedAddress?.slice(0, 8)}...{connectedAddress?.slice(-4)}</code> is not registered in the Voters Directory.
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

  // ── Status-Based Views ─────────────────────────────────────────────────────

  if (profile.verificationStatus === 'rejected') {
    return <RejectedView profile={profile} onRefresh={() => fetchProfileAndElections(true)} refreshing={refreshing} />;
  }

  if (profile.verificationStatus === 'verified') {
    return <VerifiedView profile={profile} elections={elections} dbSource={dbSource} />;
  }

  // Default: pending
  return <PendingView profile={profile} onRefresh={() => fetchProfileAndElections(true)} refreshing={refreshing} />;
}
