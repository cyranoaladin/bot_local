import { useState, useEffect, type FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Badge } from '@mui/material';
import { HelpOutline, CloudDownload, CloudUpload, Description, Notifications } from '@mui/icons-material';
import WalletButton from '../wallet/WalletButton';
import WalletBalance from '../wallet/WalletBalance';
import BotConfig from './BotConfig';
import BotControl from './BotControl';
import PerformanceStats from './PerformanceStats';
import TransactionHistory from './TransactionHistory';
import WalletSection from '../WalletSection';
import useTradingBot from '../../hooks/useTradingBot';
import { useWebSocket } from '../../hooks/useWebSocket';
import NotificationCenter from '../ui/NotificationCenter';
// Importation directe du composant LogViewer sans utiliser l'importation de module
const LogViewer = () => {
  return (
    <div>
      <h3>Logs du système</h3>
      <div style={{ 
        padding: '10px', 
        maxHeight: '400px', 
        overflow: 'auto', 
        backgroundColor: '#1e1e1e',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        whiteSpace: 'pre-wrap',
        border: '1px solid #333',
        borderRadius: '4px'
      }}>
        <p>Chargement des logs...</p>
        <p>Cette fonctionnalité sera disponible dans la prochaine mise à jour.</p>
      </div>
    </div>
  );
};

const Dashboard: FC = () => {
  const { connected } = useWallet();
  // Initialize the trading bot
  const { isRunning } = useTradingBot();
  
  // Initialiser le WebSocket
  const { 
    connected: wsConnected, 
    priceUpdate, 
    botState, 
    latestTransaction, 
    notifications,
    clearNotification,
    clearAllNotifications
  } = useWebSocket();
  
  // État pour les dialogues
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  
  // Mettre à jour les données du bot en temps réel
  useEffect(() => {
    if (botState) {
      // Mettre à jour l'état du bot dans le hook useTradingBot si nécessaire
      // Cette partie dépend de l'implémentation de useTradingBot
    }
  }, [botState]);
  
  // Mettre à jour les données de prix en temps réel
  useEffect(() => {
    if (priceUpdate) {
      // Mettre à jour les données de prix si nécessaire
    }
  }, [priceUpdate]);
  
  // Mettre à jour l'historique des transactions en temps réel
  useEffect(() => {
    if (latestTransaction) {
      // Mettre à jour l'historique des transactions si nécessaire
    }
  }, [latestTransaction]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">$COLLAT Trading Bot</h1>
            <p className="text-gray-400 mt-1">Automated trading with asymmetric thresholds</p>
          </div>
          <WalletButton />
        </div>
      </header>
      
      {connected ? (
        <>
          {/* Section Wallet */}
          <div className="mb-6">
            <WalletSection />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <WalletBalance />
              <BotConfig />
            </div>
            
            {/* Middle column */}
            <div className="space-y-6">
              <PerformanceStats />
              <BotControl />
            </div>
            
            {/* Right column */}
            <div>
              <TransactionHistory />
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-gray-800 rounded-xl">
          <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet to Start</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Phantom wallet to configure and launch the $COLLAT trading bot.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      )}
      
      <footer className="mt-12 text-center text-gray-500 text-sm">
        <div className="flex justify-center space-x-4 mb-4">
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<HelpOutline />}
            onClick={() => setHelpDialogOpen(true)}
          >
            Aide
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<Description />}
            onClick={() => setLogsDialogOpen(true)}
          >
            Logs
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            startIcon={<CloudDownload />}
            onClick={() => setBackupDialogOpen(true)}
          >
            Sauvegarde/Restauration
          </Button>
          <Badge badgeContent={notifications.length} color="error">
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<Notifications />}
              onClick={() => setNotificationsDialogOpen(true)}
            >
              Notifications
            </Button>
          </Badge>
        </div>
        <p>$COLLAT Trading Bot &copy; {new Date().getFullYear()}</p>
        <div className="flex justify-center items-center space-x-4 mt-1">
          <p>
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            Bot Status: {isRunning ? 'Running' : 'Inactive'}
          </p>
          <p>
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${wsConnected ? 'bg-blue-500' : 'bg-gray-500'}`}></span>
            WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
          </p>
        </div>
      </footer>
      
      {/* Centre de notifications flottant */}
      {notifications.length > 0 && !notificationsDialogOpen && (
        <NotificationCenter 
          notifications={notifications.slice(0, 3)} 
          onClearNotification={clearNotification}
          onClearAllNotifications={clearAllNotifications}
        />
      )}
      
      {/* Dialog d'aide */}
      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="md">
        <DialogTitle>Guide d'utilisation du $COLLAT Trading Bot</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <h3 className="text-lg font-bold mb-2">Configuration du wallet</h3>
            <p className="mb-4">
              Pour utiliser le bot de trading, vous devez d'abord importer votre wallet Phantom en utilisant votre phrase de récupération (seed phrase).
              Cette phrase est stockée localement avec un chiffrement AES-256-GCM et protégée par un mot de passe maître que vous définissez.
            </p>
            
            <h3 className="text-lg font-bold mb-2">Stratégie de trading</h3>
            <p className="mb-4">
              Le bot est configuré pour vendre 50% de vos $COLLAT lorsque le prix augmente de 10%, et acheter du $COLLAT avec 100% de votre USDC
              lorsque le prix baisse de 5% après une vente. Vous pouvez ajuster ces seuils dans la section Configuration.
            </p>
            
            <h3 className="text-lg font-bold mb-2">Sécurité</h3>
            <p className="mb-4">
              Votre phrase de récupération est stockée uniquement sur votre machine locale et est chiffrée.
              Le bot ne transmet jamais vos informations privées à des serveurs externes.
            </p>
            
            <h3 className="text-lg font-bold mb-2">Dépannage</h3>
            <p>
              Si vous rencontrez des problèmes, consultez les logs du bot pour plus de détails.
              Vous pouvez également arrêter et redémarrer le bot depuis la section Contrôle.
            </p>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Fermer</Button>
          <Button variant="contained" color="primary" onClick={() => window.open('/documentation.pdf', '_blank')}>Documentation complète</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog des logs */}
      <Dialog open={logsDialogOpen} onClose={() => setLogsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Logs du bot</DialogTitle>
        <DialogContent>
          <LogViewer />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsDialogOpen(false)}>Fermer</Button>
          <Button variant="contained" color="primary" onClick={() => window.open('/api/logs/download', '_blank')}>Télécharger les logs</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog de sauvegarde/restauration */}
      <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)}>
        <DialogTitle>Sauvegarde et restauration</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vous pouvez sauvegarder la configuration de votre bot et votre historique de transactions.
            Cette sauvegarde ne contient PAS votre phrase de récupération ou votre mot de passe maître pour des raisons de sécurité.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialogOpen(false)}>Annuler</Button>
          <Button startIcon={<CloudDownload />} variant="contained" color="primary" onClick={() => window.open('/api/backup/download', '_blank')}>Télécharger la sauvegarde</Button>
          <Button startIcon={<CloudUpload />} variant="outlined" color="primary">Restaurer une sauvegarde</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog des notifications */}
      <Dialog open={notificationsDialogOpen} onClose={() => setNotificationsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Notifications</DialogTitle>
        <DialogContent>
          {notifications.length > 0 ? (
            <NotificationCenter 
              notifications={notifications} 
              onClearNotification={clearNotification}
              onClearAllNotifications={clearAllNotifications}
            />
          ) : (
            <DialogContentText>Aucune notification disponible.</DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotificationsDialogOpen(false)}>Fermer</Button>
          <Button variant="contained" color="primary" onClick={clearAllNotifications}>Effacer toutes les notifications</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Dashboard;

