import { http, createConfig } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [hardhat],
  connectors: [
    metaMask(),        // MetaMask SDK connector (preferred)
    injected(),        // Generic injected fallback (Brave Wallet, etc.)
  ],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
});
