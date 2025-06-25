import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_INFO } from '../../config/constants';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WalletBalance: FC = () => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balances, setBalances] = useState({
    COLLAT: 0,
    USDC: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicKey || !connected) return;
      
      setIsLoading(true);
      try {
        // Fetch token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        // Debug: log all token accounts returned
        console.log('[DEBUG] Token accounts:', tokenAccounts.value);

        let collatBalance: number | null = null;
        let usdcBalance: number | null = null;
        let foundCollatMint = false;

        tokenAccounts.value.forEach((tokenAccount) => {
          const accountData = tokenAccount.account.data.parsed.info;
          const tokenMint = accountData.mint;
          const tokenAmount = accountData.tokenAmount?.uiAmount ?? 0;

          if (tokenMint === TOKEN_INFO.COLLAT.address) {
            foundCollatMint = true;
            collatBalance = tokenAmount ?? 0;
          } else if (tokenMint === TOKEN_INFO.USDC.address) {
            usdcBalance = tokenAmount ?? 0;
          }
        });

        setBalances({
          COLLAT: collatBalance ?? 0,
          USDC: usdcBalance ?? 0,
        });

        // Debug: warn if no COLLAT account found
        if (!foundCollatMint) {
          console.warn('[WARN] Aucun compte associé au mint $COLLAT trouvé pour', TOKEN_INFO.COLLAT.address);
        }
        if (foundCollatMint && (collatBalance === 0 || collatBalance === null)) {
          console.warn('[WARN] Compte $COLLAT trouvé mais le solde est zéro ou non défini.');
        }
      } catch (error) {
        console.error('Failed to fetch token balances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
    // Suppression du polling automatique pour éviter la surconsommation d'API.
    // Le rafraîchissement se fait désormais uniquement sur action utilisateur.
  }, [publicKey, connected, connection]);

  if (!connected) {
    return (
      <div className="card">
        <h3 className="text-lg font-medium mb-2">Wallet Balance</h3>
        <p className="text-gray-400">Connect your wallet to view balances</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-2">Wallet Balance</h3>
      <button
        className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 mb-3"
        onClick={() => {
          setIsLoading(true);
          setTimeout(() => {
            // Pour éviter le double-clic trop rapide
            (async () => {
              const { publicKey, connected } = useWallet();
              if (!publicKey || !connected) return;
              try {
                // Fetch token accounts
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                  publicKey,
                  { programId: TOKEN_PROGRAM_ID }
                );
                let collatBalance: number | null = null;
                let usdcBalance: number | null = null;
                tokenAccounts.value.forEach((tokenAccount) => {
                  const accountData = tokenAccount.account.data.parsed.info;
                  const tokenMint = accountData.mint;
                  const tokenAmount = accountData.tokenAmount?.uiAmount ?? 0;
                  if (tokenMint === TOKEN_INFO.COLLAT.address) {
                    collatBalance = tokenAmount ?? 0;
                  } else if (tokenMint === TOKEN_INFO.USDC.address) {
                    usdcBalance = tokenAmount ?? 0;
                  }
                });
                setBalances({
                  COLLAT: collatBalance ?? 0,
                  USDC: usdcBalance ?? 0,
                });
              } catch (error) {
                console.error('Failed to fetch token balances:', error);
              } finally {
                setIsLoading(false);
              }
            })();
          }, 200);
        }}
        disabled={isLoading}
      >
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
      <div>
        <strong>COLLAT:</strong> {balances.COLLAT}
      </div>
      <div>
        <strong>USDC:</strong> {balances.USDC}
      </div>
    </div>
  );

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-2">Wallet Balance</h3>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">USDC:</span>
            <span className="font-medium">{balances.USDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">COLLAT:</span>
            <span className="font-medium">{balances.COLLAT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
          </div>
          {balances.COLLAT === 0 && (
            <div className="text-yellow-400 text-xs mt-1">
              Aucun solde $COLLAT détecté. Vérifiez que le mint <span className="font-mono">{TOKEN_INFO.COLLAT.address}</span> correspond à votre token et que le compte associé existe.<br />
              Consultez la console pour plus de détails (debug token accounts).
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Wallet:</span>
              <span className="font-mono text-xs text-gray-400 truncate max-w-[180px]">
                {publicKey?.toString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletBalance;
