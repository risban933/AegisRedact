/**
 * Authentication routes
 */

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, registrationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public routes
router.post('/register', registrationLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.delete('/account', authenticate, authController.deleteAccount);

export default router;
