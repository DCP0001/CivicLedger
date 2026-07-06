import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  walletAddress: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string | null;
}

interface AuthState {
  adminToken: string | null;
  adminUser: Omit<User, 'walletAddress' | 'verificationStatus' | 'verificationNotes'> | null;
  voterToken: string | null;
  voterUser: User | null;
  walletMode: 'local';
  localPrivateKey: string | null;
  localAddress: string | null;
  setAdminSession: (token: string, user: Omit<User, 'walletAddress' | 'verificationStatus' | 'verificationNotes'>) => void;
  clearAdminSession: () => void;
  setVoterSession: (token: string, user: User) => void;
  updateVoterVerificationStatus: (status: VerificationStatus, notes?: string | null) => void;
  clearVoterSession: () => void;
  setWalletMode: (mode: 'local') => void;
  setLocalWallet: (privateKey: string, address: string) => void;
  clearLocalWallet: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      adminToken: null,
      adminUser: null,
      voterToken: null,
      voterUser: null,
      walletMode: 'local',
      localPrivateKey: null,
      localAddress: null,
      setAdminSession: (token, user) => set({ adminToken: token, adminUser: user }),
      clearAdminSession: () => set({ adminToken: null, adminUser: null }),
      setVoterSession: (token, user) => set({ voterToken: token, voterUser: user }),
      updateVoterVerificationStatus: (status, notes) =>
        set((state) =>
          state.voterUser
            ? {
                voterUser: {
                  ...state.voterUser,
                  verificationStatus: status,
                  verificationNotes: notes,
                },
              }
            : {}
        ),
      clearVoterSession: () => set({ voterToken: null, voterUser: null }),
      setWalletMode: (mode) => set({ walletMode: 'local' }),
      setLocalWallet: (privateKey, address) => set({ localPrivateKey: privateKey, localAddress: address }),
      clearLocalWallet: () => set({ localPrivateKey: null, localAddress: null }),
    }),
    {
      name: 'secure-vote-auth',
    }
  )
);
