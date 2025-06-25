import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from './logger';

// Interface pour étendre la requête Express avec l'utilisateur
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Liste des routes publiques qui ne nécessitent pas d'authentification
 */
const publicRoutes = [
  '/api/wallet/status',
  '/wallet/status',
  '/api/wallet/import',
  '/wallet/import',
  '/api/wallet/unlock',
  '/wallet/unlock',
  '/api/wallet/lock',
  '/wallet/lock',
  '/api/bot/status',
  '/bot/status',
  '/api/price/current',
  '/price/current',
  '/api/login',
  '/login'
];

// Log des routes publiques au démarrage
logger.info(`Public routes configured: ${publicRoutes.join(', ')}`);

/**
 * Middleware pour authentifier les requêtes avec JWT
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  // Vérifier si la route est publique
  if (publicRoutes.includes(req.path)) {
    logger.info(`Public route access: ${req.path}`);
    return next();
  }
  
  // Ignorer l'authentification en mode développement si configuré
  if (config.app.env === 'development' && process.env.SKIP_AUTH === 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, config.app.apiSecret, (err, user) => {
      if (err) {
        logger.warn(`Authentication failed: ${err.message}`);
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }

      req.user = user;
      next();
    });
  } else {
    logger.warn(`Authentication required for protected route: ${req.path}`);
    res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
};

/**
 * Génère un token JWT pour l'authentification
 */
export const generateToken = (userId: string, role: string = 'admin'): string => {
  return jwt.sign(
    { id: userId, role },
    config.app.apiSecret,
    { expiresIn: '24h' }
  );
};

/**
 * Vérifie si un utilisateur a les droits d'administrateur
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    logger.warn(`Admin access denied for user: ${req.user?.id}`);
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }
};
