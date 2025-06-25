#!/bin/bash

# Chemin vers le répertoire du projet
PROJECT_DIR="/home/alaeddine/Documents/bot_collat_local"
PID_FILE="$PROJECT_DIR/bot.pid"
LOG_FILE="$PROJECT_DIR/bot.log"

echo "Arrêt du service bot de trading $COLLAT"
echo "======================================"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    
    # Vérifier si le processus existe toujours
    if ps -p $PID > /dev/null; then
        echo "Arrêt du bot avec PID: $PID"
        kill $PID
        echo "$(date): Bot arrêté manuellement" >> "$LOG_FILE"
        echo "Le bot a été arrêté avec succès."
    else
        echo "Le processus avec PID $PID n'existe plus."
    fi
    
    # Supprimer le fichier PID
    rm "$PID_FILE"
else
    echo "Fichier PID non trouvé. Le bot n'est probablement pas en cours d'exécution."
fi
