#!/bin/bash

echo "Installation du bot de trading $COLLAT"
echo "======================================"

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "Node.js n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Installation des dépendances
echo "Installation des dépendances..."
npm install

# Configuration de la base de données
echo "Configuration de la base de données..."
cd backend
npx prisma generate
npx prisma migrate dev --name init

# Retour au répertoire principal
cd ..

echo "Installation terminée avec succès!"
echo "Pour démarrer le bot, exécutez: npm run start"
echo ""
echo "IMPORTANT: N'oubliez pas de configurer votre wallet et votre mot de passe maître"
echo "via le dashboard avant de démarrer le trading automatique."
