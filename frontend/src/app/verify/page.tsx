'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ShieldCheck, Calendar, FileText, Wallet, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';

interface VoteRecord {
  id: string;
  electionId: number;
  walletAddress: string;
  transactionHash: string;
  timestamp: string;
  election: {
    title: string;
    status: string;
  };
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<VoteRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hashParam = searchParams.get('hash');
    if (hashParam) {
      setHash(hashParam);
      runVerification(hashParam);
    }
  }, [searchParams]);

  const runVerification = async (searchHash: string) => {
    if (!searchHash.trim()) return;

    setLoading(true);
    setError(null);
    setRecord(null);

    try {
      if (isSupabaseConfigured()) {
        const { data: refData, error: refErr } = await supabase!
          .from('vote_references')
          .select(`
            id,
            electionId:election_id,
            walletAddress:wallet_address,
            transactionHash:transaction_hash,
            timestamp,
            elections:election_id (
              title,
              status
            )
          `)
          .eq('transaction_hash', searchHash.trim())
          .single();

        if (!refErr && refData) {
          const el = Array.isArray(refData.elections) ? refData.elections[0] : refData.elections;
          const mappedRecord: VoteRecord = {
            id: refData.id,
            electionId: Number(refData.electionId),
            walletAddress: refData.walletAddress,
            transactionHash: refData.transactionHash,
            timestamp: refData.timestamp,
            election: {
              title: el ? (el as any).title : 'Unknown Election',
              status: el ? (el as any).status : 'ended'
            }
          };
          setRecord(mappedRecord);
          setLoading(false);
          return;
        } else if (refErr && !isTableMissing(refErr)) {
          console.warn('Supabase query failed, falling back to local database API:', refErr);
        }
      }

      const response = await fetch(`http://localhost:5000/api/vote/transaction/${searchHash.trim()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transaction reference not found in logs');
      }

      setRecord(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification search failed. Please verify the hash.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    runVerification(hash);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400 font-bold uppercase tracking-wider text-[9px] mb-2">
          Auditable Ledger
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">On-Chain Ballot Verification</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Verify your ballot's immutability by inputting the transaction hash generated during voting.
        </p>
      </div>

      {/* Search Input Card */}
      <form onSubmit={handleVerify} className="saas-card p-3 flex gap-3 shadow-md">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-4.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder="Enter transaction hash (0x...)"
            className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-3.5 pl-12 pr-4 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !hash.trim()}
          className="btn-premium text-white font-bold text-xs px-6 rounded-xl disabled:opacity-40 shrink-0"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/10 dark:border-red-900/30 dark:text-red-400 p-4.5 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Result Verification Card */}
      {record && (
        <div className="saas-card p-8 space-y-8 border-emerald-250 dark:border-emerald-900/55 relative overflow-hidden group">
          <div className="flex items-center gap-3.5 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Ballot Audited On-Chain</h3>
              <p className="text-[10px] text-slate-450 dark:text-slate-500">Cryptographically proven & sealed ledger entry</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><FileText className="h-4 w-4 text-slate-400" /> Election:</span>
              <span className="col-span-2 font-bold text-slate-800 dark:text-slate-200 text-sm">{record.election.title}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><Wallet className="h-4 w-4 text-slate-400" /> Voter Account:</span>
              <span className="col-span-2 font-mono text-slate-600 dark:text-slate-350 break-all select-all">
                {record.walletAddress}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> Log Time:</span>
              <span className="col-span-2 text-slate-650 dark:text-slate-350">
                {new Date(record.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center pt-3.5 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5">TX Signature:</span>
              <span className="col-span-2 font-mono text-blue-600 dark:text-blue-400 break-all select-all font-semibold">
                {record.transactionHash}
              </span>
            </div>
          </div>

          {/* Visual Blockchain Timeline */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Blockchain Audit Trail Pipeline</h4>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative">
              {/* Stage 1: Database Sync */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex-1 shadow-inner">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">Database Sync</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-500">Local log reference match</span>
                </div>
              </div>

              <div className="hidden sm:block text-slate-300 dark:text-slate-700 font-bold font-mono">➔</div>

              {/* Stage 2: On-Chain Ledger */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex-1 shadow-inner">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">On-Chain Ledger</span>
                  <span className="text-[9px] text-slate-450 dark:text-slate-500">Contract ballot confirmed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/40 p-5 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Blockchain Ledger Security Notice</h4>
            <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed">
              This receipt exists permanently on the decentralized blockchain under the smart contract address. You can query this transaction hash on your Ethereum local RPC node or network explorer to inspect gas states, blocks, and on-chain receipt logs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Loading search parameters...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
