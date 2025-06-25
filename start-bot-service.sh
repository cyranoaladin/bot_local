#!/bin/bash

# Chemin vers le répertoire du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$PROJECT_DIR/bot.log"

echo "Démarrage du service bot de trading $COLLAT en arrière-plan"
echo "==========================================================="

# Se déplacer vers le répertoire du projet
cd "$PROJECT_DIR"

# Démarrer le backend en arrière-plan
echo "$(date): Démarrage du service bot" >> "$LOG_FILE"
cd backend
nohup npm run start:bot > "$LOG_FILE" 2>&1 &

# Enregistrer le PID pour pouvoir arrêter le service plus tard
echo $! > "$PROJECT_DIR/bot.pid"

echo "Le bot a été démarré en arrière-plan avec PID: $(cat $PROJECT_DIR/bot.pid)"
echo "Les logs sont disponibles dans: $LOG_FILE"
echo ""
echo "Pour arrêter le bot, exécutez: ./stop-bot-service.sh"
