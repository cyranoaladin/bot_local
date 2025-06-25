import winston from 'winston';
import config from '../config/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = config.app.env || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports to use
const transports = [
  // Console transport for all logs
  new winston.transports.Console(),
  
  // File transport for error logs
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  
  // File transport for all logs
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Ajouter une fonction pour récupérer les logs récents
const recentLogs: any[] = [];

// Intercepter les logs pour les stocker en mémoire
logger.on('logging', (transport, level, msg, meta) => {
  recentLogs.push({
    timestamp: new Date().toISOString(),
    level,
    message: msg,
    meta
  });
  
  // Limiter la taille du tableau des logs récents
  if (recentLogs.length > 1000) {
    recentLogs.shift();
  }
});

// Ajouter la fonction getRecentLogs au logger
interface ExtendedLogger extends winston.Logger {
  getRecentLogs(limit: number): any[];
}

(logger as ExtendedLogger).getRecentLogs = (limit: number = 100): any[] => {
  return recentLogs.slice(-Math.min(limit, recentLogs.length)).reverse();
};

export default logger as ExtendedLogger;
