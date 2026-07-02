'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWriteContract, useAccount, useReadContract } from 'wagmi';
import { SECURE_VOTE_ABI, SECURE_VOTE_ADDRESS } from '@/config/contract';
import {
  Plus, Users, ShieldAlert, CheckCircle, Clock, Trash, Database, Globe,
  BadgeCheck, XCircle, MessageSquare, CalendarDays, Loader2
} from 'lucide-react';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';

interface Candidate {
  id: number;
  name: string;
  party: string;
  imageUrl: string;
  description: string;
}

interface Election {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  candidates: Candidate[];
}

interface Voter {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  role: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string | null;
  createdAt?: string;
}

interface WhitelistVoterButtonProps {
  electionId: number;
  voter: Voter;
  actionLoading: boolean;
  onWhitelist: (electionId: number, wallet: string) => Promise<void>;
}

function WhitelistVoterButton({ electionId, voter, actionLoading, onWhitelist }: WhitelistVoterButtonProps) {
  const { data: isWhitelisted, isLoading, refetch } = useReadContract({
    address: SECURE_VOTE_ADDRESS,
    abi: SECURE_VOTE_ABI,
    functionName: 'isRegistered',
    args: [BigInt(electionId), voter.walletAddress as `0x${string}`],
  });

  if (isLoading) {
    return (
      <span className="text-[10px] font-medium bg-white/5 border border-white/5 text-gray-500 px-3 py-1 rounded-lg animate-pulse">
        Checking: {voter.name}...
      </span>
    );
  }

  if (isWhitelisted) {
    return (
      <span className="text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg flex items-center gap-1">
        <CheckCircle className="h-3 w-3" /> {voter.name} (Whitelisted)
      </span>
    );
  }

  return (
    <button
      onClick={async () => {
        await onWhitelist(electionId, voter.walletAddress);
        setTimeout(() => refetch(), 2000);
      }}
      disabled={actionLoading}
      className="text-[10px] font-medium bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
    >
      Whitelist: {voter.name} ({voter.walletAddress.slice(0, 5)}...)
    </button>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { adminToken } = useAuthStore();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'elections' | 'voters' | 'verification'>('elections');

  // Lists
  const [elections, setElections] = useState<Election[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [pendingVoters, setPendingVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);

  // Verification review notes state
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // Forms - Election Creation
  const [elId, setElId] = useState('');
  const [elTitle, setElTitle] = useState('');
  const [elDesc, setElDesc] = useState('');
  const [elStart, setElStart] = useState('');
  const [elEnd, setElEnd] = useState('');

  // Forms - Candidate Configuration
  const [candId, setCandId] = useState('');
  const [candElectionId, setCandElectionId] = useState('');
  const [candName, setCandName] = useState('');
  const [candParty, setCandParty] = useState('');
  const [candDesc, setCandDesc] = useState('');

  // Forms - Voter Registration
  const [voterName, setVoterName] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [voterWallet, setVoterWallet] = useState('');

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }
    fetchData();
  }, [adminToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data: elData, error: elErr } = await supabase!
          .from('elections')
          .select(`
            id,
            title,
            description,
            startDate:start_date,
            endDate:end_date,
            status,
            candidates (
              id,
              name,
              party,
              imageUrl:image_url,
              description
            )
          `)
          .order('id', { ascending: true });

        const { data: voData, error: voErr } = await supabase!
          .from('voters')
          .select('id, name, email, walletAddress:wallet_address, role, verificationStatus:verification_status, verificationNotes:verification_notes, createdAt:created_at')
          .order('created_at', { ascending: false });

        if (!elErr && !voErr) {
          const allVoters = (voData as any) || [];
          setElections((elData as any) || []);
          setVoters(allVoters);
          setPendingVoters(allVoters.filter((v: Voter) => v.verificationStatus === 'pending'));
          setLoading(false);
          return;
        }
      }

      const elRes = await fetch('http://localhost:5000/api/elections');
      const voRes = await fetch('http://localhost:5000/api/voters', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      if (elRes.ok) setElections(await elRes.json());
      if (voRes.ok) {
        const allVoters = await voRes.json();
        setVoters(allVoters);
        setPendingVoters(allVoters.filter((v: Voter) => v.verificationStatus === 'pending'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Approve or Reject a voter
  const handleVerifyVoter = async (voterId: string, status: 'verified' | 'rejected', voterName: string) => {
    const notes = reviewNotes[voterId] || '';
    const action = status === 'verified' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} voter "${voterName}"?`)) return;
    setActionLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('voters')
          .update({
            verification_status: status,
            verification_notes: notes || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', voterId);

        if (!sbErr) {
          showMsg(`Voter "${voterName}" has been ${status === 'verified' ? 'approved ✓' : 'rejected ✗'}.`, status === 'verified' ? 'success' : 'error');
          setReviewNotes((prev) => { const n = { ...prev }; delete n[voterId]; return n; });
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('Supabase verification update failed: ' + sbErr.message);
        }
      }

      const response = await fetch(`http://localhost:5000/api/voters/${voterId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification update failed');
      }

      showMsg(`Voter "${voterName}" has been ${status === 'verified' ? 'approved ✓' : 'rejected ✗'}.`, status === 'verified' ? 'success' : 'error');
      setReviewNotes((prev) => { const n = { ...prev }; delete n[voterId]; return n; });
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Verification failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Create Election Form Action
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      showMsg('Please connect your admin wallet to create elections.', 'error');
      return;
    }
    setActionLoading(true);

    try {
      const id = parseInt(elId, 10);
      const startUnix = Math.floor(new Date(elStart).getTime() / 1000);
      const endUnix = Math.floor(new Date(elEnd).getTime() / 1000);

      // 1. Write to Smart Contract
      const tx = await writeContractAsync({
        address: SECURE_VOTE_ADDRESS,
        abi: SECURE_VOTE_ABI,
        functionName: 'createElection',
        args: [BigInt(id), elTitle, elDesc, BigInt(startUnix), BigInt(endUnix)],
      });
      console.log('On-Chain election created, TX:', tx);

      // 2. Write to Supabase or Backend
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('elections')
          .insert([{
            id,
            title: elTitle,
            description: elDesc,
            start_date: elStart,
            end_date: elEnd,
            status: 'draft'
          }]);
        
        if (!sbErr) {
          showMsg(`Election "${elTitle}" created and deployed successfully!`, 'success');
          setElId('');
          setElTitle('');
          setElDesc('');
          setElStart('');
          setElEnd('');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('On-chain created, but Supabase sync failed: ' + sbErr.message);
        }
      }

      const response = await fetch('http://localhost:5000/api/elections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id,
          title: elTitle,
          description: elDesc,
          startDate: elStart,
          endDate: elEnd
        }),
      });

      if (!response.ok) {
        throw new Error('On-chain created, but backend registry failed');
      }

      showMsg(`Election "${elTitle}" created and deployed successfully!`, 'success');
      setElId('');
      setElTitle('');
      setElDesc('');
      setElStart('');
      setElEnd('');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Creation failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Candidate Form Action
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      showMsg('Please connect your admin wallet.', 'error');
      return;
    }
    setActionLoading(true);

    try {
      const electionId = parseInt(candElectionId, 10);
      const candidateId = parseInt(candId, 10);

      // 1. Write to Smart Contract
      const tx = await writeContractAsync({
        address: SECURE_VOTE_ADDRESS,
        abi: SECURE_VOTE_ABI,
        functionName: 'addCandidate',
        args: [BigInt(electionId), BigInt(candidateId), candName, candParty],
      });
      console.log('On-Chain candidate added, TX:', tx);

      // 2. Write to Supabase or Backend
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('candidates')
          .insert([{
            id: candidateId,
            election_id: electionId,
            name: candName,
            party: candParty,
            image_url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=120&q=80',
            description: candDesc
          }]);
        
        if (!sbErr) {
          showMsg(`Candidate "${candName}" registered successfully!`, 'success');
          setCandId('');
          setCandName('');
          setCandParty('');
          setCandDesc('');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('On-chain added, but Supabase sync failed: ' + sbErr.message);
        }
      }

      const response = await fetch(`http://localhost:5000/api/candidates/${electionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id: candidateId,
          name: candName,
          party: candParty,
          description: candDesc
        }),
      });

      if (!response.ok) {
        throw new Error('On-chain added, but backend sync failed');
      }

      showMsg(`Candidate "${candName}" registered successfully!`, 'success');
      setCandId('');
      setCandName('');
      setCandParty('');
      setCandDesc('');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Adding candidate failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Register Voter Form Action
  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('voters')
          .insert([{
            name: voterName,
            email: voterEmail,
            wallet_address: voterWallet.toLowerCase(),
            role: 'voter'
          }]);
        
        if (!sbErr) {
          showMsg(`Voter "${voterName}" registered successfully in Supabase!`, 'success');
          setVoterName('');
          setVoterEmail('');
          setVoterWallet('');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('Voter Supabase registry failed: ' + sbErr.message);
        }
      }

      const response = await fetch('http://localhost:5000/api/voters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: voterName,
          email: voterEmail,
          walletAddress: voterWallet
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Voter database registry failed');
      }

      showMsg(`Voter "${voterName}" registered successfully!`, 'success');
      setVoterName('');
      setVoterEmail('');
      setVoterWallet('');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Voter registration failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Voter Profile Action
  const handleDeleteVoter = async (voterId: string, voterName: string) => {
    if (!confirm(`Are you sure you want to delete voter "${voterName}"?`)) return;
    setActionLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('voters')
          .delete()
          .eq('id', voterId);

        if (!sbErr) {
          showMsg(`Voter "${voterName}" deleted from Supabase successfully!`, 'success');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('Supabase voter deletion failed: ' + sbErr.message);
        }
      }

      // SQLite Fallback
      const response = await fetch(`http://localhost:5000/api/voters/${voterId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete voter from database');
      }

      showMsg(`Voter "${voterName}" deleted successfully!`, 'success');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Deletion failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Sync / White-list Voter wallet on-chain for a specific election
  const whitelistVoterOnChain = async (electionId: number, wallet: string) => {
    if (!isConnected) {
      showMsg('Please connect your admin wallet first.', 'error');
      return;
    }
    setActionLoading(true);

    try {
      const tx = await writeContractAsync({
        address: SECURE_VOTE_ADDRESS,
        abi: SECURE_VOTE_ABI,
        functionName: 'registerVoter',
        args: [BigInt(electionId), wallet as `0x${string}`],
      });
      showMsg(`Voter wallet address whitelisted on-chain. TX: ${tx.slice(0, 10)}...`, 'success');
    } catch (err: any) {
      showMsg(err.message || 'On-chain registration failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Start Election (Open voting)
  const startElectionVoting = async (electionId: number) => {
    if (!isConnected) {
      showMsg('Connect your admin wallet to publish to blockchain.', 'error');
      return;
    }
    setActionLoading(true);

    try {
      // 1. Call Smart Contract
      const tx = await writeContractAsync({
        address: SECURE_VOTE_ADDRESS,
        abi: SECURE_VOTE_ABI,
        functionName: 'startElection',
        args: [BigInt(electionId)],
      });
      console.log('Election started on blockchain:', tx);

      // 2. Sync to Supabase or Backend
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('elections')
          .update({ status: 'active' })
          .eq('id', electionId);
        
        if (!sbErr) {
          showMsg('Election opened and active for public voting!', 'success');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('On-chain active, but failed to sync Supabase status');
        }
      }

      const response = await fetch(`http://localhost:5000/api/elections/${electionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!response.ok) {
        throw new Error('On-chain active, but failed to sync backend status');
      }

      showMsg('Election opened and active for public voting!', 'success');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Failed to start election', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // End Election (Lock voting)
  const endElectionVoting = async (electionId: number) => {
    if (!isConnected) {
      showMsg('Connect your admin wallet.', 'error');
      return;
    }
    setActionLoading(true);

    try {
      // 1. Call Smart Contract
      const tx = await writeContractAsync({
        address: SECURE_VOTE_ADDRESS,
        abi: SECURE_VOTE_ABI,
        functionName: 'endElection',
        args: [BigInt(electionId)],
      });
      console.log('Election ended on blockchain:', tx);

      // 2. Sync to Supabase or Backend
      if (isSupabaseConfigured()) {
        const { error: sbErr } = await supabase!
          .from('elections')
          .update({ status: 'ended' })
          .eq('id', electionId);
        
        if (!sbErr) {
          showMsg('Election completed! Results locked and computed on-chain.', 'success');
          fetchData();
          return;
        } else if (!isTableMissing(sbErr)) {
          throw new Error('On-chain locked, but failed to sync Supabase status');
        }
      }

      const response = await fetch(`http://localhost:5000/api/elections/${electionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'ended' }),
      });

      if (!response.ok) {
        throw new Error('On-chain locked, but failed to sync backend status');
      }

      showMsg('Election completed! Results locked and computed on-chain.', 'success');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Failed to end election', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Heading */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Administration Control</h1>
          <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Configure secure elections, whitelist voter credentials, and sign smart contracts.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-105 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab('elections')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
              activeTab === 'elections'
                ? 'bg-white dark:bg-[#0f1524] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-250'
            }`}
          >
            Manage Elections
          </button>
          <button
            onClick={() => setActiveTab('voters')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
              activeTab === 'voters'
                ? 'bg-white dark:bg-[#0f1524] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-250'
            }`}
          >
            Voter Registry
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'verification'
                ? 'bg-white dark:bg-[#0f1524] text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-250'
            }`}
          >
            Verification Queue
            {pendingVoters.length > 0 && (
              <span className="inline-flex items-center justify-center h-4.5 min-w-[1.15rem] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {pendingVoters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-400' 
            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/10 dark:border-red-900/30 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4.5 w-4.5" /> : <ShieldAlert className="h-4.5 w-4.5" />}
          <p>{message.text}</p>
        </div>
      )}

      {loading ? (
        <div className="saas-card text-center py-24 animate-pulse text-slate-500 text-xs">
          Loading administration metrics...
        </div>
      ) : activeTab === 'elections' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Election Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="saas-card p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Plus className="h-4.5 w-4.5 text-blue-500" />
                Create Election
              </h3>
              <form onSubmit={handleCreateElection} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Election Blockchain ID</label>
                  <input
                    type="number"
                    required
                    value={elId}
                    onChange={(e) => setElId(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-805 dark:text-slate-200 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Title</label>
                  <input
                    type="text"
                    required
                    value={elTitle}
                    onChange={(e) => setElTitle(e.target.value)}
                    placeholder="Presidential Vote"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-805 dark:text-slate-200 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Description</label>
                  <textarea
                    required
                    value={elDesc}
                    onChange={(e) => setElDesc(e.target.value)}
                    placeholder="Short summary of this election..."
                    rows={3}
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-805 dark:text-slate-200 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={elStart}
                    onChange={(e) => setElStart(e.target.value)}
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={elEnd}
                    onChange={(e) => setElEnd(e.target.value)}
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-premium w-full text-white font-bold text-xs py-3 rounded-xl shadow-md mt-2 disabled:opacity-50"
                >
                  {actionLoading ? 'Broadcasting...' : 'Deploy & Register Election'}
                </button>
              </form>
            </div>

            {/* Add Candidate Form */}
            <div className="saas-card p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Users className="h-4.5 w-4.5 text-blue-500" />
                Add Candidate
              </h3>
              <form onSubmit={handleAddCandidate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Target Election</label>
                  <select
                    required
                    value={candElectionId}
                    onChange={(e) => setCandElectionId(e.target.value)}
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 transition-colors bg-white dark:bg-[#0f1524]"
                  >
                    <option value="">Select Election</option>
                    {elections.filter(e => e.status === 'draft').map(e => (
                      <option key={e.id} value={e.id}>{e.title} (ID: {e.id})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Candidate ID</label>
                    <input
                      type="number"
                      required
                      value={candId}
                      onChange={(e) => setCandId(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Name</label>
                    <input
                      type="text"
                      required
                      value={candName}
                      onChange={(e) => setCandName(e.target.value)}
                      placeholder="Alice Smith"
                      className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Party Affiliation</label>
                  <input
                    type="text"
                    required
                    value={candParty}
                    onChange={(e) => setCandParty(e.target.value)}
                    placeholder="Independent"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-850 dark:text-slate-200 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Brief Biography</label>
                  <textarea
                    required
                    value={candDesc}
                    onChange={(e) => setCandDesc(e.target.value)}
                    placeholder="Candidate short manifesto description..."
                    rows={2}
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-805 dark:text-slate-200 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !candElectionId}
                  className="btn-premium w-full text-white font-bold text-xs py-3 rounded-xl shadow-md mt-2 disabled:opacity-50"
                >
                  {actionLoading ? 'Broadcasting...' : 'Deploy Candidate Profile'}
                </button>
              </form>
            </div>
          </div>

          {/* Elections List Display */}
          <div className="lg:col-span-2 space-y-6">
            <div className="saas-card p-6 space-y-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span>Configured Elections</span>
                <span className="text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-650 px-2.5 py-0.5 rounded dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">Total: {elections.length}</span>
              </h3>
              {elections.length === 0 ? (
                <p className="text-xs text-slate-450 text-center py-10">No elections registered in backend system.</p>
              ) : (
                <div className="space-y-6">
                  {elections.map((election) => (
                    <div key={election.id} className="p-5 bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-650 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400 rounded">
                              ID: {election.id}
                            </span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{election.title}</h4>
                          </div>
                          <p className="text-xs text-slate-505 dark:text-slate-400 mt-1 leading-relaxed">{election.description}</p>
                        </div>
                        <div>
                          {election.status === 'draft' ? (
                            <button
                              onClick={() => startElectionVoting(election.id)}
                              disabled={actionLoading || election.candidates.length === 0}
                              className="bg-emerald-50 hover:bg-emerald-105 border border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-700 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-97 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                            >
                              <Globe className="h-3.5 w-3.5" /> Start Voting
                            </button>
                          ) : election.status === 'active' ? (
                            <button
                              onClick={() => endElectionVoting(election.id)}
                              disabled={actionLoading}
                              className="bg-red-50 hover:bg-red-105 border border-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-750 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-97 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400"
                            >
                              <Clock className="h-3.5 w-3.5" /> End Voting
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-655 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Candidate sub-list */}
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2.5">Candidates Profile Whitelist</span>
                        {election.candidates.length === 0 ? (
                          <p className="text-xs text-amber-600 dark:text-amber-500">No candidates added yet. This election cannot be activated.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {election.candidates.map((cand) => (
                              <div key={cand.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#0f1524] rounded-xl border border-slate-200 dark:border-slate-800">
                                <img
                                  src={cand.imageUrl}
                                  alt={cand.name}
                                  className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-900 object-cover border border-slate-200 dark:border-slate-800 shadow-xs"
                                />
                                <div>
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {cand.name}
                                  </div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                                    {cand.party} (ID: {cand.id})
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Voter Register On-Chain Helper */}
                      {election.status !== 'ended' && (
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Whitelist Registered Voter Wallets On-Chain</span>
                          <div className="flex flex-wrap gap-2">
                            {voters.map((voter) => (
                              <WhitelistVoterButton
                                key={voter.id}
                                electionId={election.id}
                                voter={voter}
                                actionLoading={actionLoading}
                                onWhitelist={whitelistVoterOnChain}
                              />
                            ))}
                            {voters.length === 0 && (
                              <p className="text-xs text-slate-450">Create voters in the 'Voter Registry' tab first.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'verification' ? (
        <div className="space-y-6">
          {/* Verification Queue Panel */}
          <div className="saas-card p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BadgeCheck className="h-4.5 w-4.5 text-amber-500" />
                Pending Verification Requests
              </h3>
              <span className="text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 px-2.5 py-0.5 rounded">
                {pendingVoters.length} Pending
              </span>
            </div>

            {pendingVoters.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <BadgeCheck className="h-12 w-12 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">All caught up!</p>
                <p className="text-xs text-slate-400">No pending verification requests at this time.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {pendingVoters.map((voter) => (
                  <div key={voter.id} className="p-5 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-4">
                    {/* Voter Info Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{voter.name}</h4>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> Pending Review
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{voter.email}</p>
                        <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{voter.walletAddress}</p>
                        {voter.createdAt && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Registered {new Date(voter.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Review Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Review Notes (Optional)
                      </label>
                      <textarea
                        value={reviewNotes[voter.id] || ''}
                        onChange={(e) => setReviewNotes((prev) => ({ ...prev, [voter.id]: e.target.value }))}
                        placeholder="Add reason for approval or rejection..."
                        rows={2}
                        className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 transition-colors"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleVerifyVoter(voter.id, 'verified', voter.name)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-97 disabled:opacity-50"
                      >
                        <BadgeCheck className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleVerifyVoter(voter.id, 'rejected', voter.name)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-97 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Voters with Status Overview */}
          <div className="saas-card p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span>All Voters — Verification Status</span>
              <span className="text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-650 px-2.5 py-0.5 rounded dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">Total: {voters.length}</span>
            </h3>
            {voters.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No voters in the system.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-500">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 text-[9px] uppercase font-bold tracking-wider">
                      <th className="py-2.5 px-2">Name</th>
                      <th className="py-2.5 px-2">Email</th>
                      <th className="py-2.5 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voters.map((voter) => (
                      <tr key={voter.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors border-t border-slate-100 dark:border-slate-800">
                        <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-200">{voter.name}</td>
                        <td className="py-3 px-2">{voter.email}</td>
                        <td className="py-3 px-2">
                          {voter.verificationStatus === 'verified' ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 w-fit">
                              <BadgeCheck className="h-3 w-3" /> Verified
                            </span>
                          ) : voter.verificationStatus === 'rejected' ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 w-fit">
                              <XCircle className="h-3 w-3" /> Rejected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 w-fit">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Register Voter Panel */}
          <div className="lg:col-span-1">
            <div className="saas-card p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Users className="h-4.5 w-4.5 text-blue-500" />
                Register New Voter
              </h3>
              <form onSubmit={handleRegisterVoter} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    placeholder="Alice Johnson"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-100 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={voterEmail}
                    onChange={(e) => setVoterEmail(e.target.value)}
                    placeholder="alice@gmail.com"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-100 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Ethereum Wallet Address</label>
                  <input
                    type="text"
                    required
                    value={voterWallet}
                    onChange={(e) => setVoterWallet(e.target.value)}
                    placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs font-mono text-slate-800 dark:text-slate-100 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-premium w-full text-white font-bold text-xs py-3 rounded-xl shadow-md mt-2 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Register Off-Chain User'}
                </button>
              </form>
            </div>
          </div>

          {/* Registered Voters Directory */}
          <div className="lg:col-span-2">
            <div className="saas-card p-6 space-y-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span>Registered Voters Directory</span>
                <span className="text-[9px] font-bold bg-slate-100 border border-slate-205 text-slate-650 px-2.5 py-0.5 rounded dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">Total: {voters.length}</span>
              </h3>

              {voters.length === 0 ? (
                <p className="text-xs text-slate-450 text-center py-10">No voters registered in the directory database.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-500 glass-table">
                    <thead>
                      <tr className="text-slate-405 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-2">Name</th>
                        <th className="py-2.5 px-2">Email</th>
                        <th className="py-2.5 px-2">Wallet Address</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voters.map((voter) => (
                        <tr key={voter.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                          <td className="py-3.5 px-2 font-bold text-slate-800 dark:text-slate-200">{voter.name}</td>
                          <td className="py-3.5 px-2">{voter.email}</td>
                          <td className="py-3.5 px-2 font-mono text-blue-600 dark:text-blue-450">{voter.walletAddress}</td>
                          <td className="py-3.5 px-2">
                            {voter.verificationStatus === 'verified' ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 w-fit">
                                <BadgeCheck className="h-3 w-3" /> Verified
                              </span>
                            ) : voter.verificationStatus === 'rejected' ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 w-fit">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 w-fit">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <button
                              onClick={() => handleDeleteVoter(voter.id, voter.name)}
                              disabled={actionLoading}
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors inline-flex items-center"
                              title="Delete Voter"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
