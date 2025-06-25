import React, { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Snackbar, Alert, Divider } from '@mui/material';
import { LockOpen, Lock, Refresh, Save, AccountBalanceWallet } from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import apiClient from '../api/apiClient';

const WalletSection: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [walletStatus, setWalletStatus] = useState<'locked' | 'unlocked' | 'not_configured'>('locked');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Vérifier le statut du wallet au chargement et surveiller la connexion Phantom
  useEffect(() => {
    checkWalletStatus();
  }, []); // Exécuter uniquement au chargement initial
  
  // Effet séparé pour gérer les changements de connexion Phantom
  useEffect(() => {
    // Afficher un message lorsque le wallet Phantom est connecté
    if (connected && publicKey) {
      console.log('Wallet Phantom connecté:', publicKey.toString());
      setSnackbar({
        open: true,
        message: `Wallet Phantom connecté: ${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`,
        severity: 'success'
      });
    }
  }, [connected, publicKey]);

  const checkWalletStatus = async () => {
    try {
      const response = await apiClient.get<{status: 'locked' | 'unlocked' | 'not_configured'}>('/wallet/status');
      // La réponse contient un objet avec une propriété 'status'
      if (response && typeof response === 'object' && 'status' in response) {
        setWalletStatus(response.status);
      } else {
        console.error('Format de réponse inattendu:', response);
        setWalletStatus('not_configured');
      }
    } catch (error: any) {
      console.error('Erreur lors de la vérification du statut du wallet:', error);
      setWalletStatus('not_configured');
    }
  };

  const handleImportWallet = async () => {
    console.log('Début de l\'importation du wallet');
    
    // Vérifier si Phantom est connecté
    if (!connected || !publicKey) {
      console.error('Phantom wallet non connecté');
      setSnackbar({
        open: true,
        message: 'Veuillez d\'abord connecter votre wallet Phantom avec le bouton en haut à droite',
        severity: 'error'
      });
      return;
    }

    console.log('Phantom connecté avec l\'adresse:', publicKey.toString());

    // Valider les entrées
    if (!seedPhrase.trim()) {
      setSnackbar({
        open: true,
        message: 'Veuillez entrer votre phrase de récupération',
        severity: 'error'
      });
      return;
    }

    if (!masterPassword.trim()) {
      setSnackbar({
        open: true,
        message: 'Veuillez définir un mot de passe maître',
        severity: 'error'
      });
      return;
    }

    if (masterPassword !== confirmPassword) {
      setSnackbar({
        open: true,
        message: 'Les mots de passe ne correspondent pas',
        severity: 'error'
      });
      return;
    }

    try {
      console.log('Envoi de la requête d\'importation avec l\'adresse Phantom:', publicKey.toString());
      
      // Appel API pour importer le wallet
      await apiClient.post('/wallet/import', {
        seedPhrase,
        masterPassword,
        phantomAddress: publicKey.toString() // Envoyer l'adresse Phantom pour vérification
      });
      
      console.log('Wallet importé avec succès');
      
      setSnackbar({
        open: true,
        message: 'Wallet importé avec succès! Vous pouvez maintenant le déverrouiller.',
        severity: 'success'
      });
      
      // Ne pas fermer de dialogue puisqu'on n'en utilise plus
      setSeedPhrase('');
      setMasterPassword('');
      setConfirmPassword('');
      checkWalletStatus(); // Rafraîchir le statut
    } catch (error: any) {
      console.error('Erreur lors de l\'importation du wallet:', error);
      
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Erreur lors de l\'importation du wallet',
        severity: 'error'
      });
    }
  };

  const handleUnlockWallet = async () => {
    // Valider l'entrée
    if (!masterPassword.trim()) {
      setSnackbar({
        open: true,
        message: 'Veuillez entrer votre mot de passe maître',
        severity: 'error'
      });
      return;
    }

    try {
      await apiClient.post('/wallet/unlock', { masterPassword });
      // Ne pas vider le mot de passe pour permettre de le réutiliser facilement
      setSnackbar({
        open: true,
        message: 'Wallet déverrouillé avec succès!',
        severity: 'success'
      });
      checkWalletStatus();
    } catch (error: any) {
      console.error('Erreur lors du déverrouillage du wallet:', error);
      setSnackbar({
        open: true,
        message: 'Mot de passe incorrect ou erreur de déverrouillage.',
        severity: 'error'
      });
    }
  };

  const handleLockWallet = async () => {
    try {
      await apiClient.post('/wallet/lock');
      setWalletStatus('locked');
      setSnackbar({
        open: true,
        message: 'Wallet verrouillé avec succès!',
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Erreur lors du verrouillage du wallet:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du verrouillage du wallet.',
        severity: 'error'
      });
    }
  };

  return (
    <Card sx={{ mb: 4, bgcolor: 'background.paper' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Gestion du Wallet
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography>
              Statut du wallet local: {' '}
              <Typography component="span" sx={{ fontWeight: 'bold', color: walletStatus === 'unlocked' ? 'success.main' : 'error.main' }}>
                {walletStatus === 'unlocked' ? 'Déverrouillé' : walletStatus === 'locked' ? 'Verrouillé' : 'Non configuré'}
              </Typography>
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Phantom: {' '}
              <Typography component="span" sx={{ fontWeight: 'bold', color: connected ? 'success.main' : 'error.main' }}>
                {connected ? 'Connecté' : 'Déconnecté'}
              </Typography>
              {publicKey && (
                <Typography component="span" sx={{ ml: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </Typography>
              )}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<Refresh />}
              onClick={checkWalletStatus}
            >
              Actualiser
            </Button>
            <WalletMultiButton />
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />

        {/* SECTION CONFIGURATION DU WALLET - TOUJOURS VISIBLE */}
        <Box sx={{ mt: 3, p: 3, border: '2px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'background.default' }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
            Configuration du Wallet pour le Trading Automatique
          </Typography>
          
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
            <Typography variant="body1" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
              <strong>Important:</strong> Pour que le bot puisse trader automatiquement, vous devez:
            </Typography>
            <Typography component="ol" sx={{ pl: 2 }}>
              <li>Connecter votre wallet Phantom avec le bouton ci-dessus</li>
              <li>Entrer votre phrase de récupération et un mot de passe maître ci-dessous</li>
              <li>Cliquer sur le bouton "Enregistrer ma phrase et mon mot de passe"</li>
            </Typography>
          </Box>
          
          {/* Champs de saisie toujours visibles */}
          <TextField
            fullWidth
            margin="normal"
            label="Phrase de récupération (12 mots)"
            type="text"
            variant="outlined"
            value={seedPhrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeedPhrase(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Entrez les 12 mots de votre phrase de récupération Phantom"
            helperText="Cette phrase donne accès à votre wallet. Elle sera chiffrée localement."
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Mot de passe maître"
            type="password"
            variant="outlined"
            value={masterPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMasterPassword(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Créez un mot de passe fort pour protéger votre wallet"
            helperText="Ce mot de passe sera utilisé pour chiffrer votre phrase de récupération."
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="Confirmer le mot de passe"
            type="password"
            variant="outlined"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            error={confirmPassword !== masterPassword && confirmPassword !== ''}
            helperText={confirmPassword !== masterPassword && confirmPassword !== '' ? "Les mots de passe ne correspondent pas" : "Confirmez votre mot de passe maître"}
            sx={{ mb: 3 }}
          />
          
          {/* Bouton de confirmation toujours visible */}
          <Button 
            variant="contained" 
            color="primary" 
            size="large" 
            fullWidth 
            startIcon={<Save />}
            onClick={handleImportWallet}
            disabled={!seedPhrase || !masterPassword || masterPassword !== confirmPassword}
            sx={{ mb: 2, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
          >
            Enregistrer ma phrase et mon mot de passe
          </Button>
          
          {walletStatus === 'locked' && (
            <Button 
              variant="outlined" 
              color="primary" 
              size="large" 
              fullWidth 
              startIcon={<LockOpen />}
              onClick={handleUnlockWallet}
              disabled={!masterPassword}
              sx={{ mb: 2 }}
            >
              Déverrouiller mon wallet
            </Button>
          )}
          
          {walletStatus === 'unlocked' && (
            <Button 
              variant="outlined" 
              color="error" 
              size="large" 
              fullWidth 
              startIcon={<Lock />}
              onClick={handleLockWallet}
              sx={{ mb: 2 }}
            >
              Verrouiller mon wallet
            </Button>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            <strong>Sécurité:</strong> Votre phrase de récupération est chiffrée localement avec AES-256-GCM et protégée par votre mot de passe maître.
            Aucune donnée sensible n'est transmise à des serveurs externes. Le bot utilise cette configuration pour signer automatiquement les transactions.
          </Typography>
        </Box>

        {/* Informations sur le statut actuel */}
        {walletStatus === 'unlocked' && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.1)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
              Trading automatique activé
            </Typography>
            <Typography variant="body2">
              Votre wallet est déverrouillé. Le bot peut maintenant effectuer des transactions automatiquement selon la stratégie configurée.
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Snackbar pour les notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({...snackbar, open: false})}
      >
        <Alert 
          onClose={() => setSnackbar({...snackbar, open: false})} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default WalletSection;
