#!/bin/bash

# Script complet pour configurer et démarrer le bot de trading $COLLAT en autonomie
# Ce script compile le backend, construit le frontend et lance le bot en arrière-plan

# Définir le chemin du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "=== Configuration du bot de trading $COLLAT ==="
echo "Ce script va préparer et démarrer le bot en mode autonome"

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "Installation de PM2 (gestionnaire de processus)..."
    npm install -g pm2
fi

# Arrêter toute instance existante du bot
echo "Arrêt des instances existantes du bot..."
pm2 stop collat-bot-backend 2>/dev/null || true
pm2 delete collat-bot-backend 2>/dev/null || true

# Compiler le backend
echo "Compilation du backend..."
cd "$PROJECT_DIR/backend"
npm run build

# Retour au répertoire principal
cd "$PROJECT_DIR"

# Construire le frontend
echo "Construction du frontend..."
npm run build

# Créer un fichier de configuration PM2
cat > "$PROJECT_DIR/collat-bot.config.js" << EOL
module.exports = {
  apps : [{
    name: "collat-bot-backend",
    script: "./backend/dist/app.js",
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    watch: false,
    max_memory_restart: "200M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    merge_logs: true,
    restart_delay: 10000
  }]
}
EOL

# Créer le répertoire de logs s'il n'existe pas
mkdir -p "$PROJECT_DIR/logs"

# Démarrer le bot avec PM2
echo "Démarrage du bot de trading $COLLAT en arrière-plan..."
pm2 start "$PROJECT_DIR/collat-bot.config.js"

# Afficher le statut
pm2 status

echo ""
echo "=== Bot de trading $COLLAT démarré avec succès ==="
echo "Le bot fonctionne maintenant en arrière-plan et continuera à trader même si vous fermez cette fenêtre."
echo ""
echo "Pour accéder au dashboard, exécutez: ./start_dashboard.sh"
echo "Pour voir les logs: pm2 logs collat-bot-backend"
echo "Pour arrêter le bot: pm2 stop collat-bot-backend"
echo "Pour configurer le démarrage automatique au boot: pm2 startup && pm2 save"
echo ""
echo "Vérifiez que votre wallet est correctement configuré et déverrouillé dans le dashboard."
