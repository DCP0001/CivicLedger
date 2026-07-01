import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  walletAddress: string;
}

interface AuthState {
  adminToken: string | null;
  adminUser: Omit<User, 'walletAddress'> | null;
  voterToken: string | null;
  voterUser: User | null;
  setAdminSession: (token: string, user: Omit<User, 'walletAddress'>) => void;
  clearAdminSession: () => void;
  setVoterSession: (token: string, user: User) => void;
  clearVoterSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      adminToken: null,
      adminUser: null,
      voterToken: null,
      voterUser: null,
      setAdminSession: (token, user) => set({ adminToken: token, adminUser: user }),
      clearAdminSession: () => set({ adminToken: null, adminUser: null }),
      setVoterSession: (token, user) => set({ voterToken: token, voterUser: user }),
      clearVoterSession: () => set({ voterToken: null, voterUser: null }),
    }),
    {
      name: 'secure-vote-auth',
    }
  )
);
