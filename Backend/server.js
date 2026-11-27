// ==========================================
// GameList Express Server - PostgreSQL Backend
// ==========================================
import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/schema.js';
import pool from './db/pool.js';
import gamesRouter from './routes/games.js';
import userRouter from './routes/user.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware
// ==========================================

// Built-in Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Native CORS Middleware (Pure Node & Express, no external libraries)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request Logger Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// API Routes
// ==========================================

// Health & Info Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'GameList Express Server (PostgreSQL) is active and running',
    version: '2.0.0',
    database: 'PostgreSQL',
    endpoints: {
      health: 'GET /api/health',
      games: 'GET /api/games',
      gameById: 'GET /api/games/:id',
      genres: 'GET /api/games/genres',
      platforms: 'GET /api/games/platforms',
      trending: 'GET /api/games/trending',
      auth: 'POST /api/auth/register | POST /api/auth/login | GET /api/auth/me | PUT /api/auth/profile',
      userProfile: 'GET /api/user/profile',
      userList: 'GET /api/user/list | PUT /api/user/list/:gameId | DELETE /api/user/list/:gameId',
      dbStats: 'GET /api/stats',
    }
  });
});

// Health Check with DB status
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      database: 'connected',
      dbTime: dbResult.rows[0].now,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'ERROR',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Database stats endpoint
app.get('/api/stats', async (req, res, next) => {
  try {
    const [games, genres, platforms, trending, userGames, users] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM games'),
      pool.query('SELECT COUNT(*) FROM genres'),
      pool.query('SELECT COUNT(*) FROM platforms'),
      pool.query('SELECT COUNT(*) FROM trending_games'),
      pool.query('SELECT COUNT(*) FROM user_games'),
      pool.query('SELECT COUNT(*) FROM users'),
    ]);

    res.json({
      games: parseInt(games.rows[0].count),
      genres: parseInt(genres.rows[0].count),
      platforms: parseInt(platforms.rows[0].count),
      trending_games: parseInt(trending.rows[0].count),
      user_games: parseInt(userGames.rows[0].count),
      users: parseInt(users.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

// Mount route modules
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/user', userRouter);

// ==========================================
// 404 & Error Handling
// ==========================================

// 404 Not Found Middleware
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    requestedUrl: req.originalUrl,
    method: req.method,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ==========================================
// Start Server
// ==========================================
async function startServer() {
  try {
    // Initialize database tables
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 GameList Express Server v2.0 (PostgreSQL)`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🎮 Games API: http://localhost:${PORT}/api/games`);
      console.log(`📊 DB Stats: http://localhost:${PORT}/api/stats`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
