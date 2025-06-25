#!/bin/bash

# Script pour démarrer le dashboard du bot $COLLAT
# Ce script lance un serveur web léger pour servir l'interface utilisateur

# Définir le chemin du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Vérifier si serve est installé
if ! command -v serve &> /dev/null; then
    echo "Le package 'serve' n'est pas installé. Installation en cours..."
    npm install -g serve
fi

# Construire le frontend si nécessaire
if [ ! -d "./dist" ]; then
    echo "Construction du frontend..."
    npm run build
fi

# Démarrer le serveur frontend
echo "Démarrage du dashboard $COLLAT..."
echo "Accédez au dashboard à l'adresse: http://localhost:5000"
serve -s dist -l 5000
