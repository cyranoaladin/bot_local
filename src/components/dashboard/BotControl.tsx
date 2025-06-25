import { useState, useEffect, type FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import useTradeStore from '../../store/useTradeStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { CircularProgress } from '@mui/material';

const BotControl: FC = () => {
  const { connected, publicKey } = useWallet();
  const { isActive, setActive, resetBot, isLoading } = useTradeStore();
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Utiliser le WebSocket pour obtenir l'état du bot en temps réel
  const { botState, connected: wsConnected } = useWebSocket();
  
  // Synchroniser l'état du bot avec les données WebSocket
  useEffect(() => {
    if (botState) {
      // Mettre à jour l'état actif du bot en fonction des données WebSocket
      setActive(botState.isRunning);
      
      // Si le bot a une erreur, on pourrait la propager si disponible
      // Note: errorMessage n'est pas dans l'interface BotState actuelle
      // mais pourrait être ajouté plus tard
    }
  }, [botState, setActive]);

  const handleStart = async () => {
    if (!connected || !publicKey) {
      setLocalError('Connectez votre wallet Phantom pour démarrer le bot.');
      return;
    }
    
    try {
      // Appel API pour démarrer le bot
      const response = await fetch('/api/bot/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors du démarrage du bot');
      }
      
      setLocalError(null);
      // L'état actif sera mis à jour via WebSocket
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Erreur lors du démarrage du bot');
    }
  };

  const handleStop = async () => {
    try {
      // Appel API pour arrêter le bot
      const response = await fetch('/api/bot/stop', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'arrêt du bot');
      }
      
      setLocalError(null);
      // L'état sera mis à jour via WebSocket, mais on peut aussi réinitialiser localement
      resetBot();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Erreur lors de l\'arrêt du bot');
    }
  };

  return (
    <div className="card mt-4 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">$COLLAT Trading Bot</h2>
        <div className="flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{isActive ? 'Actif' : 'Inactif'}</span>
          {!wsConnected && (
            <span className="ml-2 text-yellow-400 text-sm">(WebSocket déconnecté)</span>
          )}
        </div>
      </div>
      
      <div className="flex gap-4 mb-4">
        <button
          className="btn btn-primary flex items-center justify-center"
          onClick={handleStart}
          disabled={isActive || isLoading || !connected || !publicKey}
        >
          {isLoading ? <CircularProgress size={16} color="inherit" className="mr-2" /> : null}
          Démarrer le Bot
        </button>
        <button
          className="btn btn-danger"
          onClick={handleStop}
          disabled={!isActive || isLoading}
        >
          Arrêter le Bot
        </button>
      </div>
      
      {/* Statut du bot */}
      {botState && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium mb-2">Statut du Bot</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Prix actuel:</span>
              <span className="ml-2">${botState.currentPrice?.toFixed(6) || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Prix d'entrée:</span>
              <span className="ml-2">${botState.lastEntryPrice?.toFixed(6) || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Variation de prix:</span>
              <span className="ml-2">{botState.priceChange ? `${(botState.priceChange * 100).toFixed(2)}%` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Balance COLLAT:</span>
              <span className="ml-2">{botState.balances?.collat.toFixed(4) || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
      
      {(!connected || !publicKey) && (
        <div className="text-yellow-400 mt-2">Connectez votre wallet Phantom pour activer le trading bot.</div>
      )}
      {localError && <div className="text-red-500 mt-2">{localError}</div>}
    </div>
  );
};

export default BotControl;
