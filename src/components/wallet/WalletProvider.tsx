import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
// Utiliser l'adaptateur de portefeuille standard au lieu des adaptateurs spécifiques
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PRIMARY_RPC_ENDPOINT } from '../../config/constants';
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Définir les adaptateurs de wallet pour une connexion réelle
  // Phantom est automatiquement détecté comme wallet standard, pas besoin d'adaptateur spécifique
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = PRIMARY_RPC_ENDPOINT || clusterApiUrl(network);
  
  const wallets = useMemo(() => [
    // Ajouter explicitement l'adaptateur Phantom
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
