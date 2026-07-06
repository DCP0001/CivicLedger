'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWeb3Account } from '@/hooks/useWeb3';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { supabase, isSupabaseConfigured, isTableMissing } from '@/config/supabase';
import { 
  CheckCircle, AlertCircle, Copy, Key, Wallet, ChevronRight, Loader2, Sparkles, Eye, EyeOff
} from 'lucide-react';

export default function VoterRegister() {
  const { address: connectedAddress, isConnected } = useWeb3Account();

  // Registration Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  // Local Wallet Generator States
  const [generatedAddress, setGeneratedAddress] = useState('');
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  
  // App System States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Automatically pre-fill connected wallet address if available
  useEffect(() => {
    if (isConnected && connectedAddress && !walletAddress) {
      setWalletAddress(connectedAddress);
    }
  }, [connectedAddress, isConnected, walletAddress]);

  // Generate local browser wallet
  const handleGenerateWallet = () => {
    try {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      setGeneratedAddress(account.address);
      setGeneratedPrivateKey(privateKey);
      setWalletAddress(account.address);
      setErrorMsg(null);
    } catch (err) {
      console.error('Wallet generation failed, using standard fallback:', err);
      // Fallback random private key generation
      const fallbackBytes = new Uint8Array(32);
      window.crypto.getRandomValues(fallbackBytes);
      const fallbackKey = '0x' + Array.from(fallbackBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      try {
        const account = privateKeyToAccount(fallbackKey as `0x${string}`);
        setGeneratedAddress(account.address);
        setGeneratedPrivateKey(fallbackKey);
        setWalletAddress(account.address);
      } catch (innerErr: any) {
        setErrorMsg('Failed to generate local wallet credentials: ' + innerErr.message);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSelfRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !walletAddress) {
      setErrorMsg('Name, email, and wallet address are required.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase!
          .from('voters')
          .insert([{
            name,
            email: email.toLowerCase(),
            wallet_address: walletAddress.toLowerCase(),
            role: 'voter'
          }])
          .select()
          .single();

        if (!error && data) {
          setSuccessMsg('You have registered successfully in the system database!');
          setRegisteredUser({
            name: data.name,
            email: data.email,
            walletAddress: data.wallet_address
          });
          setLoading(false);
          return;
        } else if (error && !isTableMissing(error)) {
          throw new Error('Supabase voter registration error: ' + error.message);
        }
      }

      // SQLite Fallback self-registration API
      const response = await fetch('http://localhost:5000/api/voters/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          walletAddress
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to submit registration');
      }

      setSuccessMsg('You have registered successfully in the SQLite registry!');
      setRegisteredUser(resData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Voter registration failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Intro Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Voter Self-Registration</h1>
        <p className="text-xs text-slate-500 dark:text-slate-405 max-w-md mx-auto leading-relaxed">
          Create your voting account profile and configure your Ethereum key credentials to participate in public audits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Registration & Key Generator */}
        <div className="space-y-6">
          {/* Key Generator Card */}
          <div className="saas-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Sparkles className="h-4.5 w-4.5 text-blue-500" />
              Need an Ethereum Wallet?
            </h3>
            <p className="text-[11px] text-slate-450 dark:text-slate-500 leading-relaxed">
              If you do not have MetaMask, click below to instantly construct a secure local private key in your browser.
            </p>
            <button
              type="button"
              onClick={handleGenerateWallet}
              className="btn-premium w-full text-xs font-bold py-2.5 rounded-xl shadow-xs"
            >
              Generate Browser Wallet
            </button>

            {generatedAddress && (
              <div className="bg-slate-55 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Wallet Address</span>
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#0f1524] px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="font-mono text-[10px] truncate select-all">{generatedAddress}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedAddress)}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy Address"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest block">Private Key (Secret)</span>
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#0f1524] px-2.5 py-1.5 rounded-lg border border-red-100 dark:border-red-950/40">
                    <span className="font-mono text-[10px] truncate select-all">
                      {showPrivateKey ? generatedPrivateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {showPrivateKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedPrivateKey)}
                        className="text-slate-400 hover:text-slate-600"
                        title="Copy Key"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {copySuccess && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold text-right">
                    Copied to clipboard!
                  </p>
                )}
                
                <p className="text-[9px] text-amber-600 dark:text-amber-500 leading-normal font-medium bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  ⚠️ Import this private key into MetaMask to sign on-chain votes, or back it up securely.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Account Registration Form */}
        <div className="space-y-6">
          <div className="saas-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Wallet className="h-4.5 w-4.5 text-blue-500" />
              Register Voter Profile
            </h3>
            
            {successMsg ? (
              <div className="space-y-6 py-2">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-400 p-4.5 rounded-xl flex items-start gap-3 text-xs font-semibold">
                  <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>{successMsg}</p>
                </div>

                {/* Voter Checklist */}
                <div className="bg-slate-50 dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Next Steps to Vote:</h4>
                  
                  <div className="space-y-3.5">
                    <div className="flex items-start gap-3 text-xs">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Register Profile</span>
                        <span className="text-slate-450 dark:text-slate-500 text-[11px]">Voter profile registered off-chain: <strong>{registeredUser?.name}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 text-xs">
                      <div className="h-4.5 w-4.5 rounded-full border border-amber-500 bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 animate-pulse">!</div>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">2. On-Chain Whitelisting (Verification)</span>
                        <span className="text-slate-500 dark:text-slate-450 text-[11px] leading-relaxed">
                          Your wallet address <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 border dark:border-slate-800 text-[10px] text-blue-600 dark:text-blue-400">{registeredUser?.walletAddress.slice(0, 8)}...</code> must be whitelisted on-chain by the election administrator. Please request approval from your supervisor or administrator.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 text-xs opacity-50">
                      <div className="h-4.5 w-4.5 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">3</div>
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Cast Ballot</span>
                        <span className="text-slate-550 dark:text-slate-450 text-[11px]">Navigate back to the main portal once verified and select candidate.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/login"
                    className="btn-premium flex-1 flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl shadow-xs"
                  >
                    Login to Check Status
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/"
                    className="btn-premium-outline flex-1 flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSelfRegister} className="space-y-4">
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/10 dark:border-red-900/30 dark:text-red-400 p-4.5 rounded-xl flex items-center gap-3 text-xs font-semibold">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice Johnson"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-100 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@gmail.com"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-100 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Your Wallet Address</label>
                  <input
                    type="text"
                    required
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Connect wallet or generate"
                    className="w-full input-premium focus:border-blue-500/50 outline-none rounded-xl py-2 px-3 text-xs font-mono text-slate-800 dark:text-slate-100 transition-colors"
                  />
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal">
                    💡 If you have MetaMask connected, your address will fill automatically.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-premium w-full text-white font-bold text-xs py-3 rounded-xl shadow-md mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    'Register Account'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
