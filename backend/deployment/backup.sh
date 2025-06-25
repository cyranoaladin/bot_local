#!/bin/bash

# Script de sauvegarde automatique pour le bot de trading COLLAT
# À configurer avec cron pour une exécution quotidienne

set -e

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Sauvegarde du bot de trading COLLAT${NC}"
echo "--------------------------------------------------------"

# Configuration
BACKUP_DIR="/home/ubuntu/backups"
DB_NAME="collat_bot"
DB_USER="collat_bot"
APP_DIR="/home/ubuntu/bot_collat"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="collat_bot_backup_${TIMESTAMP}"
RETENTION_DAYS=7

# Créer le répertoire de sauvegarde s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Sauvegarde de la base de données
echo -e "${YELLOW}Sauvegarde de la base de données PostgreSQL...${NC}"
PGPASSWORD="secure_password" pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_DIR/${BACKUP_FILENAME}.dump"

# Sauvegarde des fichiers de configuration
echo -e "${YELLOW}Sauvegarde des fichiers de configuration...${NC}"
cp "$APP_DIR/backend/.env" "$BACKUP_DIR/.env.backup_${TIMESTAMP}"

# Compression des sauvegardes
echo -e "${YELLOW}Compression des sauvegardes...${NC}"
tar -czf "$BACKUP_DIR/${BACKUP_FILENAME}.tar.gz" -C "$BACKUP_DIR" "${BACKUP_FILENAME}.dump" ".env.backup_${TIMESTAMP}"

# Nettoyage des fichiers temporaires
rm "$BACKUP_DIR/${BACKUP_FILENAME}.dump" "$BACKUP_DIR/.env.backup_${TIMESTAMP}"

# Suppression des anciennes sauvegardes
echo -e "${YELLOW}Suppression des sauvegardes de plus de ${RETENTION_DAYS} jours...${NC}"
find "$BACKUP_DIR" -name "collat_bot_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

# Afficher les sauvegardes disponibles
echo -e "${YELLOW}Sauvegardes disponibles:${NC}"
ls -la "$BACKUP_DIR" | grep "collat_bot_backup_"

echo -e "${GREEN}Sauvegarde terminée avec succès!${NC}"
echo "--------------------------------------------------------"
echo -e "${YELLOW}Fichier de sauvegarde:${NC} $BACKUP_DIR/${BACKUP_FILENAME}.tar.gz"
echo "--------------------------------------------------------"

# Envoi d'une notification par email (à configurer)
# mail -s "COLLAT Bot - Sauvegarde du $(date +"%Y-%m-%d")" admin@example.com << EOF
# La sauvegarde du bot COLLAT a été effectuée avec succès.
# Fichier: $BACKUP_DIR/${BACKUP_FILENAME}.tar.gz
# EOF
