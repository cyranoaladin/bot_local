import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from './logger';

/**
 * Service de chiffrement pour sécuriser les données sensibles
 * Utilise AES-256-GCM pour le chiffrement des données
 */
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64;
  private readonly tagLength = 16;
  private readonly iterations = 100000;
  private readonly digest = 'sha512';
  private readonly encoding: BufferEncoding = 'hex';
  
  // Dossier de stockage par défaut dans le répertoire utilisateur
  private readonly storageDir: string;
  
  constructor() {
    this.storageDir = path.join(os.homedir(), '.collat-bot');
    this.ensureStorageDirExists();
  }
  
  /**
   * S'assure que le répertoire de stockage existe
   */
  private ensureStorageDirExists(): void {
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
        logger.info(`Created secure storage directory at ${this.storageDir}`);
      } catch (error) {
        logger.error(`Failed to create storage directory: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error('Failed to create secure storage directory');
      }
    }
  }
  
  /**
   * Dérive une clé à partir d'un mot de passe
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, this.digest);
  }
  
  /**
   * Chiffre des données avec un mot de passe
   */
  encrypt(data: string, password: string): string {
    try {
      // Générer un salt aléatoire
      const salt = crypto.randomBytes(this.saltLength);
      
      // Dériver la clé à partir du mot de passe et du salt
      const key = this.deriveKey(password, salt);
      
      // Générer un vecteur d'initialisation aléatoire
      const iv = crypto.randomBytes(this.ivLength);
      
      // Créer le chiffreur
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Chiffrer les données
      let encrypted = cipher.update(data, 'utf8', this.encoding);
      encrypted += cipher.final(this.encoding);
      
      // Obtenir le tag d'authentification
      const tag = cipher.getAuthTag();
      
      // Concaténer tous les éléments nécessaires pour le déchiffrement
      // Format: salt:iv:tag:encrypted
      return Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, this.encoding)
      ]).toString(this.encoding);
    } catch (error) {
      logger.error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Déchiffre des données avec un mot de passe
   */
  decrypt(encryptedData: string, password: string): string {
    try {
      // Convertir les données chiffrées en buffer
      const data = Buffer.from(encryptedData, this.encoding);
      
      // Extraire les différentes parties
      const salt = data.subarray(0, this.saltLength);
      const iv = data.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = data.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = data.subarray(this.saltLength + this.ivLength + this.tagLength).toString(this.encoding);
      
      // Dériver la clé à partir du mot de passe et du salt
      const key = this.deriveKey(password, salt);
      
      // Créer le déchiffreur
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Déchiffrer les données
      let decrypted = decipher.update(encrypted, this.encoding, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to decrypt data. Incorrect password or corrupted data.');
    }
  }
  
  /**
   * Enregistre des données chiffrées dans un fichier
   */
  saveEncryptedData(filename: string, data: string, password: string): void {
    try {
      const encryptedData = this.encrypt(data, password);
      const filePath = path.join(this.storageDir, filename);
      
      fs.writeFileSync(filePath, encryptedData, { mode: 0o600 });
      logger.info(`Saved encrypted data to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save encrypted data: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to save encrypted data');
    }
  }
  
  /**
   * Charge des données chiffrées depuis un fichier
   */
  loadEncryptedData(filename: string, password: string): string {
    try {
      const filePath = path.join(this.storageDir, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const encryptedData = fs.readFileSync(filePath, 'utf8');
      return this.decrypt(encryptedData, password);
    } catch (error) {
      logger.error(`Failed to load encrypted data: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to load encrypted data');
    }
  }
  
  /**
   * Vérifie si un fichier chiffré existe
   */
  encryptedFileExists(filename: string): boolean {
    const filePath = path.join(this.storageDir, filename);
    return fs.existsSync(filePath);
  }
  
  /**
   * Supprime un fichier chiffré
   */
  deleteEncryptedFile(filename: string): void {
    try {
      const filePath = path.join(this.storageDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted encrypted file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to delete encrypted file: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to delete encrypted file');
    }
  }
}

// Exporter une instance singleton du service
export const encryptionService = new EncryptionService();
