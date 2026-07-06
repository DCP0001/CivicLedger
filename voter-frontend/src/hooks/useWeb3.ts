import { useAuthStore } from '../store/authStore';
import { privateKeyToAccount } from 'viem/accounts';

export function useWeb3Account() {
  const { localAddress } = useAuthStore();

  const isConnected = !!localAddress;
  const address = localAddress || undefined;

  return {
    address,
    isConnected,
  };
}

export function useWeb3SignMessage() {
  const { localPrivateKey } = useAuthStore();

  const signMessageAsync = async ({ message }: { message: string }): Promise<string> => {
    if (!localPrivateKey) {
      throw new Error('No local private key configured in your browser. Please register or generate a wallet first.');
    }
    const account = privateKeyToAccount(localPrivateKey as `0x${string}`);
    return await account.signMessage({ message });
  };

  return {
    signMessageAsync,
  };
}

export function useWeb3Disconnect() {
  const { clearLocalWallet, clearVoterSession } = useAuthStore();

  const disconnect = () => {
    clearLocalWallet();
    clearVoterSession();
  };

  return {
    disconnect,
  };
}
