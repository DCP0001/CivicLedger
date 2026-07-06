'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import {
  ChevronLeft, Trophy, Users, Clock, CheckCircle2, Copy, FileText, Loader2
} from 'lucide-react';

interface Candidate {
  id: number;
  name: string;
  party: string;
  imageUrl: string;
  description: string;
  voteCount: number; // Stored and tracked in backend SQLite (synchronized on-chain)
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
          .select('id, name, party, imageUrl:image_url, description, voteCount:vote_count')
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

  if (loading || !election) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Resolving decentralized election tallies...</p>
      </div>
    );
  }

  // Use the candidates directly (they already have voteCount populated by database which is updated via blockchain)
  const results = candidates;
  const totalVotes = results.reduce((acc, curr) => acc + (curr.voteCount || 0), 0);

  // Determine winner
  let winner = results.length > 0 ? results[0] : null;
  if (totalVotes > 0) {
    results.forEach((c) => {
      if (winner && (c.voteCount || 0) > (winner.voteCount || 0)) {
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
        <div className="saas-card p-6 border-amber-350 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
          <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center rounded-xl flex-shrink-0">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
              Winner Declared
            </h3>
            <p className="text-xs text-slate-650 dark:text-slate-350">
              The blockchain has validated that <span className="font-bold text-slate-800 dark:text-slate-200">{winner.name}</span> of the <span className="font-semibold text-blue-650 dark:text-blue-400">{winner.party}</span> won this election with <span className="font-bold">{winner.voteCount} vote(s)</span> ({(winner.voteCount / totalVotes * 100).toFixed(1)}%).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Results Chart Panel */}
        <div className="saas-card p-6 space-y-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3">
            Tally & Percentage Distribution
          </h3>

          <div className="space-y-5">
            {results.map((c) => {
              const pct = totalVotes > 0 ? (c.voteCount / totalVotes) * 100 : 0;
              return (
                <div key={c.id} className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold ml-2">({c.party})</span>
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {c.voteCount || 0} vote(s) ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  {/* Custom CSS Gradient Percent Bar */}
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border dark:border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit Timeline panel */}
        <div className="saas-card p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3">
            Ballot Verification Timeline
          </h3>

          {voteRefs.length === 0 ? (
            <p className="text-xs text-slate-400">No voting logs tracked for this election.</p>
          ) : (
            <div className="space-y-5 max-h-80 overflow-y-auto pr-1">
              {voteRefs.map((ref, idx) => (
                <div key={ref.id || idx} className="flex gap-3 text-xs leading-normal">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-4 w-4 rounded-full border border-blue-500 bg-blue-500/10 flex items-center justify-center text-[8px] font-bold text-blue-600 dark:text-blue-400">
                      ✓
                    </div>
                    {idx < voteRefs.length - 1 && <div className="w-0.5 bg-slate-200 dark:bg-slate-800 flex-grow my-1" />}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span className="font-semibold">{ref.walletAddress.slice(0, 8)}...</span>
                      <span>{new Date(ref.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0c101d] px-2 py-1 rounded border border-slate-200/50 dark:border-slate-800 text-[10px] font-mono select-all text-slate-650 dark:text-slate-450 truncate">
                      <span>Hash: {ref.transactionHash.slice(0, 14)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
