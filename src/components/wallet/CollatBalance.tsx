import React, { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCoins } from "@fortawesome/free-solid-svg-icons";

const COLLAT_MINT = "C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ";
import { RPC_ENDPOINTS } from '../../config/constants';

async function getConnection(): Promise<Connection> {
  for (const url of RPC_ENDPOINTS) {
    try {
      const conn = new Connection(url, "confirmed");
      await conn.getVersion();
      return conn;
    } catch (err) {
      console.warn(`RPC ${url} failed`, err);
    }
  }
  throw new Error("No RPC endpoint available");
}

export const CollatBalance: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [collatBalance, setCollatBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || !connected) {
      setCollatBalance(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setCollatBalance(null);
    setError(null);

    (async () => {
      try {
        const connection = await getConnection();
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );
        const collatAccount = tokenAccounts.value.find(
          (acc) =>
            acc.account.data.parsed.info.mint === COLLAT_MINT
        );
        const uiAmount = collatAccount?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
        if (!cancelled) {
          setCollatBalance(uiAmount);
        }
      } catch (e) {
        console.error("Error fetching COLLAT balance:", e);
        if (!cancelled) {
          setCollatBalance(null);
          setError("Unable to fetch $COLLAT balance. Please try again later.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicKey, connected]);

  return (
    <div className="collat-balance-widget" style={{
      background: "var(--background, #18181b)",
      color: "var(--foreground, #fafafa)",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      maxWidth: 350,
      margin: "auto",
      textAlign: "center"
    }}>
      <h3 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <FontAwesomeIcon icon={faCoins} style={{ color: "#ffd700" }} /> $COLLAT Balance
      </h3>
      {connected ? (
        error ? (
          <p style={{ color: "#f87171" }}>{error}</p>
        ) : collatBalance !== null ? (
          <p style={{ fontSize: 24, fontWeight: 600 }}>
            {Number(collatBalance).toLocaleString()} COLLAT
          </p>
        ) : (
          <p>
            <span className="spinner" style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #ffd700", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            &nbsp;Loading balance...
          </p>
        )
      ) : (
        <p>Please connect your wallet to view your $COLLAT balance.</p>
      )}
      <style>{`
        @media (max-width: 500px) {
          .collat-balance-widget { padding: 12px; font-size: 15px; }
        }
        .collat-balance-widget {
          transition: background 0.2s, color 0.2s;
        }
        .spinner {
          border-width: 2px;
          border-style: solid;
          border-color: #ffd700 #ffd700 #ffd700 transparent;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
