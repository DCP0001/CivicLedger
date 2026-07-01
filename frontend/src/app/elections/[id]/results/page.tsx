'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { SECURE_VOTE_ABI, SECURE_VOTE_ADDRESS } from '@/config/contract';
import { Award, Users, BarChart3, ChevronLeft, Loader2, Trophy, Clock, ShieldCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';

interface Candidate {
  id: number;
  name: string;
  party: string;
  imageUrl: string;
  description: string;
}

interface OnChainCandidate {
  id: bigint;
  name: string;
  party: string;
  voteCount: bigint;
}

interface Election {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function ElectionResults() {
  const params = useParams();
  const router = useRouter();
  const electionId = parseInt(params.id as string, 10);

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteRefs, setVoteRefs] = useState<any[]>([]);

  // 1. Read candidate vote counts directly from the Smart Contract
  const { data: onChainCandidates, isLoading: isLoadingOnChain, refetch } = useReadContract({
    address: SECURE_VOTE_ADDRESS,
    abi: SECURE_VOTE_ABI,
    functionName: 'getCandidates',
    args: [BigInt(electionId)],
  });

  useEffect(() => {
    fetchElectionData();
  }, [electionId]);

  const fetchElectionData = async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data: elData, error: elErr } = await supabase!
          .from('elections')
          .select('*')
          .eq('id', electionId)
          .single();
          
        const { data: caData, error: caErr } = await supabase!
          .from('candidates')
          .select('id, name, party, imageUrl:image_url, description')
          .eq('election_id', electionId)
          .order('id', { ascending: true });

        const { data: refsData, error: refsErr } = await supabase!
          .from('vote_references')
          .select('id, walletAddress:wallet_address, transactionHash:transaction_hash, timestamp')
          .eq('election_id', electionId)
          .order('timestamp', { ascending: false });
          
        if (!elErr && !caErr && !refsErr && elData) {
          setElection({
            id: Number(elData.id),
            title: elData.title,
            description: elData.description,
            startDate: elData.start_date,
            endDate: elData.end_date,
            status: elData.status
          });
          setCandidates(caData || []);
          setVoteRefs(refsData || []);
          setLoading(false);
          return;
        }
      }

      const elRes = await fetch(`http://localhost:5000/api/elections/${electionId}`);
      const caRes = await fetch(`http://localhost:5000/api/candidates/${electionId}`);
      const refsRes = await fetch(`http://localhost:5000/api/vote/election/${electionId}`);

      if (elRes.ok) setElection(await elRes.json());
      if (caRes.ok) setCandidates(await caRes.json());
      if (refsRes.ok) setVoteRefs(await refsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || isLoadingOnChain || !election) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Resolving decentralized election tallies...</p>
      </div>
    );
  }

  // Combine off-chain images/bios with on-chain vote tallies
  const results = candidates.map((cand) => {
    const onChainMatch = (onChainCandidates as OnChainCandidate[])?.find(
      (c) => Number(c.id) === cand.id
    );
    return {
      ...cand,
      voteCount: onChainMatch ? Number(onChainMatch.voteCount) : 0,
    };
  });

  const totalVotes = results.reduce((acc, curr) => acc + curr.voteCount, 0);

  // Determine winner
  let winner = results.length > 0 ? results[0] : null;
  if (totalVotes > 0) {
    results.forEach((c) => {
      if (winner && c.voteCount > winner.voteCount) {
        winner = c;
      }
    });
  } else {
    winner = null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ChevronLeft className="h-4 w-4" /> Back to Directory
      </Link>

      {/* Header Summary */}
      <div className="saas-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
              <Clock className="h-3 w-3" /> Voting Closed
            </span>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-650 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400 rounded">
              Election ID: {election.id}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 leading-tight">{election.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-405 leading-relaxed">{election.description}</p>
        </div>

        {/* Total Votes Card */}
        <div className="bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shrink-0 shadow-inner">
          <div className="h-10 w-10 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-450 rounded-lg">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Total Ballots Cast</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{totalVotes}</span>
          </div>
        </div>
      </div>

      {/* Winner Callout Card */}
      {winner && totalVotes > 0 && (
        <div className="saas-card p-6 border-amber-355 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
          <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center rounded-xl flex-shrink-0">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="text-center md:text-left space-y-1.5 flex-grow">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-550/20 text-amber-650 dark:text-amber-400 font-bold uppercase tracking-wider text-[9px]">
              Declared Winner
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{winner.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Affiliation: <span className="font-semibold text-amber-700 dark:text-amber-450">{winner.party}</span> — Secured <span className="font-bold text-slate-800 dark:text-slate-200">{winner.voteCount}</span> certified on-chain ballots.
            </p>
          </div>
          <div className="relative shrink-0">
            <img
              src={winner.imageUrl}
              alt={winner.name}
              className="h-16 w-16 rounded-xl object-cover bg-slate-105 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Results Breakdown Graph */}
      <div className="saas-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-blue-500" />
            On-Chain Vote Tabulation
          </h3>
          <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-150 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400 px-2.5 py-0.5 rounded">
            Audit Confirmed
          </span>
        </div>

        {results.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No candidate metrics recorded.</p>
        ) : (
          <div className="space-y-5">
            {results.map((candidate) => {
              const percentage = totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0;
              const isWinner = winner && candidate.id === winner.id;
              
              return (
                <div key={candidate.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <div className="flex items-center gap-3">
                      <img
                        src={candidate.imageUrl}
                        alt={candidate.name}
                        className="h-7 w-7 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs"
                      />
                      <div className="flex flex-col">
                        <span className="text-slate-850 dark:text-slate-250 font-bold text-xs">{candidate.name}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-[9px]">{candidate.party}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-xs block">{candidate.voteCount} votes</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-[10px] block">{percentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Graphic Progress Bar */}
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isWinner 
                          ? 'bg-blue-600 dark:bg-blue-500' 
                          : 'bg-slate-350 dark:bg-slate-700'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decentralized Audit Trail Ledger */}
      <div className="saas-card p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-150">Public Verification Ledger</h3>
              <p className="text-xs text-slate-450">Immutable audit logs representing all verified ballots on-chain</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-550/10 border border-emerald-500/20 rounded-full dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 shadow-xs">
            Logged: {voteRefs.length} Ballots
          </span>
        </div>

        {voteRefs.length === 0 ? (
          <p className="text-sm text-slate-450 text-center py-10">No voter transaction receipts logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-500 glass-table">
              <thead>
                <tr className="text-slate-400 dark:text-slate-550 text-[9px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-2">Anonymized Voter Address</th>
                  <th className="py-2.5 px-2">Transaction Receipt (Tx Hash)</th>
                  <th className="py-2.5 px-2">Time Logged</th>
                </tr>
              </thead>
              <tbody>
                {voteRefs.map((ref) => (
                  <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                    <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-350">
                      {ref.walletAddress.slice(0, 6)}...{ref.walletAddress.slice(-4)}
                    </td>
                    <td className="py-3 px-2 font-mono">
                      <Link 
                        href={`/verify?hash=${ref.transactionHash}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline transition-colors flex items-center gap-1.5 inline-flex"
                      >
                        {ref.transactionHash.slice(0, 18)}...
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-slate-400 dark:text-slate-500">
                      {new Date(ref.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
