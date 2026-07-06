'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Calendar, Users, Award, Vote, Clock, ChevronRight } from 'lucide-react';
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

export default function Home() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbSource, setDbSource] = useState<'Supabase Cloud' | 'SQLite Fallback'>('SQLite Fallback');
  const { voterToken } = useAuthStore();

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
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

        if (!error) {
          setElections((data as any) || []);
          setDbSource('Supabase Cloud');
          setLoading(false);
          return;
        } else if (!isTableMissing(error)) {
          console.warn('Supabase query error, falling back to local backend:', error);
        } else {
          console.info('Supabase elections table missing, using local SQLite backend fallback.');
        }
      }

      // SQLite Fallback
      const response = await fetch('http://localhost:5000/api/elections');
      if (response.ok) {
        const data = await response.json();
        setElections(data);
        setDbSource('SQLite Fallback');
      }
    } catch (error) {
      console.error('Failed to fetch elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'ended':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-750 border border-red-250 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30">
            <Clock className="h-3 w-3" />
            Completed
          </span>
        );
      case 'draft':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">
            <Calendar className="h-3 w-3" />
            Upcoming
          </span>
        );
      default:
        return (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Header Section */}
      <section className="bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-soft-sm">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Next-Generation E-Voting
          </div>
          
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
            Decentralized, Secure & Accessible On-Chain Voting
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            CivicLedger makes public decisions transparent. Cast secure ballots protected by cryptographic signatures, with results computed instantly on the public ledger.
          </p>
          
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/verify"
              className="btn-premium flex items-center gap-2 px-6 py-3 text-xs font-bold shadow-sm"
            >
              Verify Ballot Record
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Vote className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Immutable Voting</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
            Every ballot is directly broadcasted and written to the decentralized ledger, guaranteeing your vote cannot be modified or deleted.
          </p>
        </div>
        
        <div className="bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Voter Confidentiality</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
            Voter registration details are securely maintained off-chain. Only anonymous wallet signatures post ballots on-chain.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Award className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Instant Audit Log</h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
            Verify the existence of any election result using public transaction hashes. Publicly transparent blockchain audit trail.
          </p>
        </div>
      </section>

      {/* Elections Directory */}
      <section className="space-y-6">
        <div className="flex justify-between items-end pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Elections Directory</h2>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                dbSource === 'Supabase Cloud' 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400' 
                  : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400'
              }`}>
                {dbSource}
              </span>
            </div>
            <p className="text-xs text-slate-450 mt-1">Select an active election to review details, select candidates, and cast your secure ballot.</p>
          </div>
          <button 
            onClick={fetchElections}
            className="btn-premium-outline text-xs font-bold px-4 py-2 rounded-xl"
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="saas-card h-52 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : elections.length === 0 ? (
          <div className="saas-card text-center py-16 rounded-2xl max-w-lg mx-auto space-y-4">
            <Vote className="h-12 w-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Elections Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              The administrator has not configured any public elections yet. Please check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {elections.map((election) => {
              const isActive = election.status.toLowerCase() === 'active';
              const isEnded = election.status.toLowerCase() === 'ended';
              
              return (
                <div key={election.id} className="saas-card p-6 flex flex-col justify-between h-full gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-1">{election.title}</h3>
                      {getStatusBadge(election.status)}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {election.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Start: {new Date(election.startDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>End: {new Date(election.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {isActive ? (
                        voterToken ? (
                          <Link
                            href={`/elections/${election.id}/vote`}
                            className="btn-premium w-full text-center text-xs font-bold py-2.5 rounded-xl shadow-sm"
                          >
                            Cast Ballot
                          </Link>
                        ) : (
                          <button
                            disabled
                            className="w-full text-center bg-slate-100 border border-slate-200/50 text-slate-400 text-xs font-semibold py-2.5 rounded-xl cursor-not-allowed dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-500"
                          >
                            Connect Wallet to Vote
                          </button>
                        )
                      ) : isEnded ? (
                        <Link
                          href={`/elections/${election.id}/results`}
                          className="w-full text-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-97"
                        >
                          View Results & Audit Ledger
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full text-center bg-slate-100 border border-slate-200/50 text-slate-400 text-xs font-semibold py-2.5 rounded-xl cursor-not-allowed dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-500"
                        >
                          Upcoming (Registration Open)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
