/**
 * Express server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔒 AegisRedact Backend API                         ║
║                                                       ║
║   Environment: ${env.NODE_ENV.padEnd(38)}║
║   Port:        ${PORT.toString().padEnd(38)}║
║   URL:         ${env.API_URL.padEnd(38)}║
║   Frontend:    ${env.FRONTEND_URL.padEnd(38)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

  if (env.isDevelopment) {
    console.log('📝 API Endpoints:');
    console.log('   POST   /api/auth/register');
    console.log('   POST   /api/auth/login');
    console.log('   POST   /api/auth/refresh');
    console.log('   POST   /api/auth/logout');
    console.log('   GET    /api/auth/profile');
    console.log('   DELETE /api/auth/account');
    console.log('   GET    /api/files');
    console.log('   POST   /api/files/upload/request');
    console.log('   GET    /api/files/:id');
    console.log('   DELETE /api/files/:id');
    console.log('   GET    /api/files/storage/quota');
    console.log('');
  }
});

export default app;
