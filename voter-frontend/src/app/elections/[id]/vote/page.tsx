'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWeb3Account, useWeb3SignMessage } from '@/hooks/useWeb3';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import {
  ChevronLeft, CheckCircle2, ShieldCheck, Vote, Loader2
} from 'lucide-react';

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
}

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const electionId = params.id as string;

  const { voterToken, voterUser } = useAuthStore();
  const { address, isConnected } = useWeb3Account();
  const { signMessageAsync } = useWeb3SignMessage();

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);

  // Blockchain Transactions State
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [votingSuccess, setVotingSuccess] = useState(false);

  // On-chain status simulation via API
  const [isRegisteredOnChain, setIsRegisteredOnChain] = useState(false);
  const [hasVotedOnChain, setHasVotedOnChain] = useState(false);

  useEffect(() => {
    if (!voterToken) {
      router.push('/');
      return;
    }
    fetchElectionData();
  }, [electionId, voterToken, address]);

  const fetchElectionData = async () => {
    try {
      setLoading(true);
      
      // Fetch voter blockchain statuses
      if (address) {
        try {
          const [regRes, voteRes] = await Promise.all([
            fetch(`http://localhost:5000/api/blockchain/is-registered?electionId=${electionId}&walletAddress=${address}`),
            fetch(`http://localhost:5000/api/blockchain/has-voted?electionId=${electionId}&walletAddress=${address}`)
          ]);
          const regData = await regRes.json();
          const voteData = await voteRes.json();
          setIsRegisteredOnChain(regData.isRegistered);
          setHasVotedOnChain(voteData.hasVoted);
        } catch (e) {
          console.error('Error reading blockchain statuses:', e);
        }
      }

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
          
        if (!elErr && !caErr && elData) {
          setElection({
            id: Number(elData.id),
            title: elData.title,
            description: elData.description,
            startDate: elData.start_date,
            endDate: elData.end_date,
            status: elData.status
          });
          setCandidates(caData || []);
          setLoading(false);
          return;
        }
      }

      const elRes = await fetch(`http://localhost:5000/api/elections/${electionId}`);
      const caRes = await fetch(`http://localhost:5000/api/candidates/${electionId}`);

      if (elRes.ok) setElection(await elRes.json());
      if (caRes.ok) setCandidates(await caRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (selectedCandidate === null || !address) return;
    setErrorMsg(null);
    setIsPending(true);

    try {
      // 1. Sign ballot transaction payload
      const type = 'CAST_VOTE';
      const sender = address.toLowerCase();
      const payload = {
        electionId: Number(electionId),
        candidateId: selectedCandidate,
      };

      const message = JSON.stringify({ type, sender, payload });
      const signature = await signMessageAsync({ message });

      setIsPending(false);
      setIsConfirming(true);

      // 2. Submit signed transaction payload to Custom Blockchain Engine API
      const bcResponse = await fetch('http://localhost:5000/api/blockchain/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, sender, payload, signature }),
      });

      const bcData = await bcResponse.json();
      if (!bcResponse.ok) {
        throw new Error(bcData.error || 'Failed to submit vote transaction to blockchain');
      }

      setHash(bcData.transaction.id);
      setVotingSuccess(true);
      setHasVotedOnChain(true);

      // 3. Write to Supabase if configured (redundant sync)
      if (isSupabaseConfigured() && voterUser) {
        const { error } = await supabase!
          .from('vote_references')
          .insert([{
            election_id: Number(electionId),
            wallet_address: voterUser.walletAddress.toLowerCase(),
            transaction_hash: bcData.transaction.id
          }]);
        if (error && !isTableMissing(error)) {
          console.error('Supabase vote sync error:', error.message);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Voting transaction rejected or failed.');
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  if (loading || !election) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Fetching secure voting credentials...</p>
      </div>
    );
  }

  // Success view
  if (votingSuccess && hash) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-8">
        <div className="saas-card p-8 space-y-6">
          <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 flex items-center justify-center rounded-2xl mx-auto">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ballot Cast Successfully</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your ballot selection has been recorded immutably on the ledger.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#0c101d] p-4 rounded-xl space-y-2 text-left font-mono text-xs border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block font-bold">TRANSACTION HASH:</span>
            <span className="text-blue-600 dark:text-blue-400 break-all select-all">{hash}</span>
          </div>

          <div className="flex gap-4">
            <Link
              href="/"
              className="w-full btn-premium-outline text-center text-xs font-bold py-3 rounded-xl"
            >
              Back to Portal
            </Link>
            <Link
              href={`/verify?hash=${hash}`}
              className="w-full btn-premium text-center text-xs font-bold py-3 rounded-xl"
            >
              Verify Ballot
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isEligibleToVote = isRegisteredOnChain && !hasVotedOnChain;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Navigation and Back */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* 5-Step Voting Stepper */}
      <div className="bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {[
            { step: 1, label: 'Connect Wallet', done: isConnected },
            { step: 2, label: 'Select Candidate', done: selectedCandidate !== null },
            { step: 3, label: 'Review Ballot', done: selectedCandidate !== null && !isPending },
            { step: 4, label: 'Sign Transaction', done: isConfirming || votingSuccess },
            { step: 5, label: 'Success', done: votingSuccess }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 dark:text-slate-450">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                item.done 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500'
              }`}>
                {item.step}
              </span>
              <span>{item.label}</span>
              {idx < 4 && <span className="hidden md:inline text-slate-200 dark:text-slate-800">➔</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Header Panel */}
      <div className="saas-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{election.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{election.description}</p>
          </div>
          
          {/* Eligibility Status */}
          <div className="flex-shrink-0">
            {hasVotedOnChain ? (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400">
                <CheckCircle2 className="h-4 w-4" /> Already Voted
              </span>
            ) : isRegisteredOnChain ? (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
                <ShieldCheck className="h-4 w-4" /> Eligible to Vote
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
                <ShieldCheck className="h-4 w-4" /> Not Whitelisted On-Chain
              </span>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/10 dark:border-red-900/30 dark:text-red-400 p-4 rounded-xl text-xs font-semibold">
            Error: {errorMsg}
          </div>
        )}
      </div>

      {/* Candidates List Selection */}
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Whitelisted Candidate Options</h3>
          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-650 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 px-2.5 py-0.5 rounded-md">
            Total Options: {candidates.length}
          </span>
        </div>
        
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">No candidates available for this election.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidate === candidate.id;
              
              return (
                <div
                  key={candidate.id}
                  onClick={() => isEligibleToVote && setSelectedCandidate(candidate.id)}
                  className={`saas-card p-6 cursor-pointer transition-all duration-200 flex flex-col justify-between border-2 gap-5 relative overflow-hidden ${
                    !isEligibleToVote 
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800' 
                      : isSelected 
                      ? 'border-blue-600 bg-blue-50/20 dark:border-blue-500 dark:bg-blue-950/10 shadow-md' 
                      : 'border-slate-200 hover:border-slate-350 dark:border-slate-800 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <img
                        src={candidate.imageUrl}
                        alt={candidate.name}
                        className="h-full w-full object-cover bg-slate-100 dark:bg-slate-900"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-600/5 border-2 border-blue-500 rounded-xl pointer-events-none" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[9px] font-black font-mono px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400 rounded">
                          ID: {candidate.id}
                        </span>
                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">{candidate.name}</h4>
                      </div>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold block">{candidate.party}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">{candidate.description}</p>
                    </div>
                  </div>
 
                  {isEligibleToVote && (
                    <div className="flex justify-end pt-2">
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm' 
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      }`}>
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {isEligibleToVote && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
          <div className="space-y-1 flex-1">
            <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ballot Summary Details</h4>
            {selectedCandidate !== null ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                You are casting a vote for <span className="text-blue-600 dark:text-blue-400 font-bold">{candidates.find(c => c.id === selectedCandidate)?.name}</span>. This action registers an irreversible transaction on the secure blockchain ledger.
              </p>
            ) : (
              <p className="text-xs text-slate-400">Please choose a candidate option above to sign your digital ballot.</p>
            )}
          </div>
          <button
            onClick={handleCastVote}
            disabled={selectedCandidate === null || isPending || isConfirming}
            className="btn-premium flex items-center gap-2 text-white font-bold text-xs px-6 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming Ballot...
              </>
            ) : isConfirming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording on Chain...
              </>
            ) : (
              <>
                <Vote className="h-3.5 w-3.5" /> Cast Secure Vote
              </>
            )}
          </button>
        </div>
      )}

      {hasVotedOnChain && (
        <div className="saas-card text-center py-10 max-w-xl mx-auto space-y-4">
          <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Ballot Successfully Cast</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 max-w-sm mx-auto leading-relaxed">
            The blockchain ledger registers that you have cast a ballot in this election. Duplicate voting is restricted on-chain to maintain platform integrity.
          </p>
        </div>
      )}
    </div>
  );
}
