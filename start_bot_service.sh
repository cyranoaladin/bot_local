#!/bin/bash

# Script pour démarrer le bot de trading $COLLAT en arrière-plan
# Ce script lance le bot de trading qui fonctionne en autonomie

# Définir le chemin du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "PM2 n'est pas installé. Installation en cours..."
    npm install -g pm2
fi

# Arrêter toute instance existante du bot et du backend
pm2 stop collat-trading-bot 2>/dev/null || true
pm2 delete collat-trading-bot 2>/dev/null || true
pm2 stop collat-backend 2>/dev/null || true
pm2 delete collat-backend 2>/dev/null || true
pm2 stop collat-frontend 2>/dev/null || true
pm2 delete collat-frontend 2>/dev/null || true

# Installer les dépendances si nécessaire
if [ ! -d "./node_modules" ]; then
    echo "Installation des dépendances principales..."
    npm install
fi

# Vérifier et installer les dépendances du backend
if [ ! -d "./backend/node_modules" ]; then
    echo "Installation des dépendances du backend..."
    cd backend && npm install && cd ..
fi

# Générer les types Prisma si nécessaire
if [ ! -f "./backend/node_modules/.prisma/client/index.js" ]; then
    echo "Génération des types Prisma..."
    cd backend && npx prisma generate && cd ..
fi

# Construire le frontend si nécessaire
if [ ! -d "./dist" ]; then
    echo "Construction du frontend..."
    npm run build
fi

# Démarrer le backend avec PM2 (avec WebSocket activé)
echo "Démarrage du backend $COLLAT avec WebSocket..."
pm2 start --name "collat-backend" npm -- --prefix backend start

# Démarrer le bot de trading avec PM2
echo "Démarrage du bot de trading $COLLAT en arrière-plan..."
pm2 start ./start_trading_bot.js --name "collat-trading-bot"

# Démarrer le frontend avec PM2
echo "Démarrage du frontend $COLLAT..."
pm2 start --name "collat-frontend" npm -- start

# Afficher le statut
pm2 status

echo ""
echo "Le système $COLLAT est maintenant en cours d'exécution en arrière-plan."
echo "Pour accéder au dashboard, ouvrez http://localhost:3000 dans votre navigateur."
echo "Le bot continuera à fonctionner même si vous fermez le navigateur."
echo ""
echo "Statut de la connexion WebSocket:"
echo "- Le WebSocket est actif sur http://localhost:5000"
echo "- Les mises à jour en temps réel seront visibles dans le dashboard"
echo ""
echo "Commandes utiles:"
echo "- Pour voir les logs du bot: pm2 logs collat-trading-bot"
echo "- Pour voir les logs du backend: pm2 logs collat-backend"
echo "- Pour voir les logs du frontend: pm2 logs collat-frontend"
echo "- Pour arrêter tous les services: pm2 stop all"
echo "- Pour redémarrer tous les services: pm2 restart all"
echo "- Pour démarrer automatiquement au démarrage: pm2 startup && pm2 save"
