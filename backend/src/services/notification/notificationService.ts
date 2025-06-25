import nodemailer from 'nodemailer';
import axios from 'axios';
import config from '../../config/config';
import logger from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

// Définir notre propre enum LogLevel pour correspondre à celui de Prisma
enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

const prisma = new PrismaClient();

class NotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private telegramEnabled: boolean = false;
  private emailEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialise le service de notification
   */
  private initialize(): void {
    // Initialiser l'email si les configurations sont disponibles
    if (
      config.notifications.email.service &&
      config.notifications.email.user &&
      config.notifications.email.password
    ) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          service: config.notifications.email.service,
          auth: {
            user: config.notifications.email.user,
            pass: config.notifications.email.password,
          },
        });
        this.emailEnabled = true;
        logger.info('Email notification service initialized');
      } catch (error) {
        logger.error(`Failed to initialize email service: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Initialiser Telegram si les configurations sont disponibles
    if (
      config.notifications.telegram.botToken &&
      config.notifications.telegram.chatId
    ) {
      this.telegramEnabled = true;
      logger.info('Telegram notification service initialized');
    }
  }

  /**
   * Envoie une alerte par email
   */
  private async sendEmailAlert(subject: string, message: string): Promise<boolean> {
    if (!this.emailEnabled || !this.emailTransporter) {
      logger.warn('Email service not enabled or properly initialized');
      return false;
    }

    try {
      const mailOptions = {
        from: config.notifications.email.user,
        to: config.notifications.email.notificationEmail,
        subject: `COLLAT Bot Alert: ${subject}`,
        text: message,
        html: `<p>${message}</p>`,
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Email alert sent: ${subject}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email alert: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Envoie une alerte via Telegram
   */
  private async sendTelegramAlert(subject: string, message: string): Promise<boolean> {
    if (!this.telegramEnabled) {
      logger.warn('Telegram service not enabled');
      return false;
    }

    try {
      const telegramMessage = `*COLLAT Bot Alert: ${subject}*\n\n${message}`;
      const telegramUrl = `https://api.telegram.org/bot${config.notifications.telegram.botToken}/sendMessage`;
      
      await axios.post(telegramUrl, {
        chat_id: config.notifications.telegram.chatId,
        text: telegramMessage,
        parse_mode: 'Markdown',
      });
      
      logger.info(`Telegram alert sent: ${subject}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send Telegram alert: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Enregistre l'alerte dans la base de données
   */
  private async logAlertToDatabase(level: LogLevel, subject: string, message: string): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level,
          message: `${subject}: ${message}`,
          context: { subject, message },
        },
      });
    } catch (error) {
      logger.error(`Failed to log alert to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Envoie une alerte via tous les canaux configurés
   */
  public async sendAlert(subject: string, message: string, level: LogLevel = LogLevel.INFO): Promise<void> {
    // Enregistrer dans la base de données
    await this.logAlertToDatabase(level, subject, message);
    
    // Envoyer par email si activé
    if (this.emailEnabled) {
      await this.sendEmailAlert(subject, message);
    }
    
    // Envoyer par Telegram si activé
    if (this.telegramEnabled) {
      await this.sendTelegramAlert(subject, message);
    }
    
    // Toujours logger
    switch (level) {
      case LogLevel.INFO:
        logger.info(`Alert - ${subject}: ${message}`);
        break;
      case LogLevel.WARNING:
        logger.warn(`Alert - ${subject}: ${message}`);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        logger.error(`Alert - ${subject}: ${message}`);
        break;
    }
  }

  /**
   * Envoie une alerte critique
   */
  public async sendCriticalAlert(subject: string, message: string): Promise<void> {
    await this.sendAlert(subject, message, LogLevel.CRITICAL);
  }

  /**
   * Envoie une alerte d'erreur
   */
  public async sendErrorAlert(subject: string, message: string): Promise<void> {
    await this.sendAlert(subject, message, LogLevel.ERROR);
  }

  /**
   * Envoie une alerte d'avertissement
   */
  public async sendWarningAlert(subject: string, message: string): Promise<void> {
    await this.sendAlert(subject, message, LogLevel.WARNING);
  }

  /**
   * Envoie une alerte d'information
   */
  public async sendInfoAlert(subject: string, message: string): Promise<void> {
    await this.sendAlert(subject, message, LogLevel.INFO);
  }
}

// Exporter une instance singleton du service
export const notificationService = new NotificationService();
