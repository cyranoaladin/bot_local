# Guide d'Utilisation du Bot de Trading $COLLAT

Ce document explique comment utiliser et gérer le bot de trading $COLLAT une fois installé sur votre serveur.

## Table des matières

1. [Accès à l'interface d'administration](#accès-à-linterface-dadministration)
2. [Configuration du bot](#configuration-du-bot)
3. [Démarrage et arrêt du bot](#démarrage-et-arrêt-du-bot)
4. [Surveillance des performances](#surveillance-des-performances)
5. [Gestion des transactions](#gestion-des-transactions)
6. [Alertes et notifications](#alertes-et-notifications)
7. [Maintenance](#maintenance)
8. [Dépannage](#dépannage)

## Accès à l'interface d'administration

L'interface d'administration est accessible via votre navigateur web à l'adresse suivante :

```
https://votre-domaine.com
```

### Authentification

Pour vous connecter à l'interface d'administration :

1. Utilisez les identifiants créés lors de l'installation
2. L'interface utilise JWT pour l'authentification, avec une durée de validité de 24 heures

### Structure de l'interface

L'interface d'administration est organisée en plusieurs sections :

- **Dashboard** : Vue d'ensemble des performances et de l'état du bot
- **Configuration** : Paramètres du bot
- **Transactions** : Historique des transactions
- **Portefeuille** : État actuel du portefeuille
- **Journaux** : Logs système et événements

## Configuration du bot

### Paramètres de trading

Les paramètres de trading peuvent être configurés dans la section **Configuration** :

- **Seuil de vente (%)** : Pourcentage d'augmentation du prix qui déclenche une vente (défaut : 10%)
- **Seuil d'achat (%)** : Pourcentage de diminution du prix qui déclenche un achat (défaut : 5%)
- **Tolérance au slippage (%)** : Pourcentage maximum de slippage accepté (défaut : 1.5%)
- **Pourcentage maximum de transaction (%)** : Pourcentage maximum des avoirs à utiliser par transaction (défaut : 50%)

### Endpoints RPC

Vous pouvez configurer les endpoints RPC Solana utilisés par le bot :

1. Endpoint primaire : Utilisé par défaut pour toutes les opérations
2. Endpoint secondaire : Utilisé en cas d'échec de l'endpoint primaire

Il est recommandé d'utiliser un endpoint RPC payant comme Helius pour une meilleure fiabilité.

### Notifications

Configurez les notifications pour être alerté des événements importants :

- **Email** : Configuration SMTP pour les alertes par email
- **Telegram** : Configuration du bot Telegram pour les alertes en temps réel

## Démarrage et arrêt du bot

### Démarrer le bot

Pour démarrer le bot de trading :

1. Accédez à la section **Dashboard** de l'interface d'administration
2. Cliquez sur le bouton **Démarrer le bot**
3. Confirmez l'action dans la boîte de dialogue

Le bot commencera à surveiller le prix du $COLLAT et exécutera des transactions selon les conditions configurées.

### Arrêter le bot

Pour arrêter le bot de trading :

1. Accédez à la section **Dashboard** de l'interface d'administration
2. Cliquez sur le bouton **Arrêter le bot**
3. Confirmez l'action dans la boîte de dialogue

Le bot cessera immédiatement toutes les opérations de trading.

### Arrêt d'urgence

En cas d'urgence, vous pouvez également arrêter le service sur le serveur :

```bash
sudo systemctl stop collat-bot
```

## Surveillance des performances

### Tableau de bord

Le tableau de bord affiche les informations essentielles sur les performances du bot :

- **État actuel** : Actif ou inactif
- **Prix actuel** : Prix actuel du $COLLAT
- **Prix d'entrée** : Prix d'entrée utilisé pour les calculs de seuil
- **Soldes** : Montants actuels de $COLLAT, USDC et SOL
- **Valeur totale** : Valeur totale du portefeuille en USDC
- **Performance** : Graphique de performance sur différentes périodes (24h, 7j, 30j)

### Métriques de performance

Les métriques suivantes sont disponibles dans la section **Performance** :

- **ROI total** : Retour sur investissement depuis le début
- **ROI quotidien** : Retour sur investissement quotidien moyen
- **Nombre de transactions** : Nombre total de transactions effectuées
- **Ratio de réussite** : Pourcentage de transactions profitables

## Gestion des transactions

### Historique des transactions

L'historique complet des transactions est disponible dans la section **Transactions** :

- Type de transaction (achat/vente)
- Montant et prix
- Date et heure
- Statut (en attente, confirmée, échouée)
- Hash de transaction Solana

### Exportation des données

Vous pouvez exporter l'historique des transactions aux formats suivants :

- CSV
- JSON
- Excel

Pour exporter les données :

1. Accédez à la section **Transactions**
2. Utilisez les filtres pour sélectionner la période souhaitée
3. Cliquez sur le bouton **Exporter**
4. Choisissez le format d'exportation

## Alertes et notifications

Le bot peut vous alerter des événements importants via email et/ou Telegram :

### Types d'alertes

- **Transactions** : Notification pour chaque transaction effectuée
- **Seuils atteints** : Notification lorsque les seuils de prix sont atteints
- **Erreurs** : Notification en cas d'erreur système
- **Performance** : Résumé quotidien des performances

### Configuration des alertes

Pour configurer les alertes :

1. Accédez à la section **Configuration**
2. Naviguez vers l'onglet **Notifications**
3. Activez ou désactivez les différents types d'alertes
4. Configurez les canaux de notification (email, Telegram)

## Maintenance

### Mises à jour

Pour mettre à jour le bot vers une nouvelle version :

```bash
# Se connecter au serveur
ssh ubuntu@votre-serveur

# Accéder au répertoire du bot
cd /home/ubuntu/bot_collat

# Récupérer les dernières modifications
git pull

# Installer les dépendances
cd backend
npm install

# Appliquer les migrations de base de données
npx prisma migrate deploy

# Compiler le code
npm run build

# Redémarrer le service
sudo systemctl restart collat-bot
```

### Sauvegardes

Les sauvegardes automatiques sont configurées lors de l'installation. Pour restaurer une sauvegarde :

```bash
# Lister les sauvegardes disponibles
ls -la /home/ubuntu/backups

# Extraire une sauvegarde
tar -xzf /home/ubuntu/backups/collat_bot_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp

# Restaurer la base de données
PGPASSWORD="votre_mot_de_passe" pg_restore -U collat_bot -d collat_bot -c /tmp/collat_bot_backup_YYYYMMDD_HHMMSS.dump

# Restaurer le fichier .env si nécessaire
cp /tmp/.env.backup_YYYYMMDD_HHMMSS /home/ubuntu/bot_collat/backend/.env
```

### Rotation des logs

Les logs du système sont automatiquement gérés par systemd et logrotate. Les logs de l'application sont stockés dans le dossier `/home/ubuntu/bot_collat/backend/logs/`.

## Dépannage

### Problèmes courants

#### Le bot ne démarre pas

Vérifiez les journaux du système :
```bash
journalctl -u collat-bot -e
```

Causes possibles :
- Erreur de configuration dans le fichier .env
- Problème de connexion à la base de données
- Erreur dans les migrations Prisma

#### Transactions échouées

Vérifiez les journaux de l'application :
```bash
cat /home/ubuntu/bot_collat/backend/logs/error.log
```

Causes possibles :
- Solde SOL insuffisant pour les frais de transaction
- Problème de connexion RPC
- Slippage trop restrictif

#### API inaccessible

Vérifiez l'état du service Nginx :
```bash
systemctl status nginx
```

Vérifiez les journaux Nginx :
```bash
cat /var/log/nginx/error.log
```

### Support technique

Si vous rencontrez des problèmes que vous ne pouvez pas résoudre, contactez notre équipe de support :

- Email : support@collat-bot.com
- Telegram : @collatbot_support

Veuillez inclure les informations suivantes dans votre demande :
- Description détaillée du problème
- Journaux pertinents
- Captures d'écran si applicable
