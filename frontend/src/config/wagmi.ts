import { http, createConfig } from 'wagmi';
import { hardhat } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [hardhat],
  connectors: [
    injected({ target: 'metaMask' })
  ],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
});
