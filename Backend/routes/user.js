// ==========================================
// User Routes - PostgreSQL backed
// Supports both authenticated users and fallback default user
// ==========================================
import { Router } from 'express';
import { query } from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Apply optional auth middleware to all user routes
router.use(optionalAuth);

// Helper to resolve current authenticated user ID from verified JWT
function getUserId(req) {
  if (req.user && req.user.id) {
    return req.user.id; // integer from JWT
  }
  return null;
}

// ------------------------------------------
// GET /api/user/profile
// ------------------------------------------
router.get('/profile', async (req, res, next) => {
  try {
    const userId = getUserId(req);

    // Fetch user profile from users table if authenticated
    let userRecord = null;
    if (req.user && req.user.id) {
      const userRes = await query(
        `SELECT id, username, email, avatar, bio, favorite_genre, created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (userRes.rows.length > 0) {
        userRecord = userRes.rows[0];
      }
    }

    // If no valid user, return empty stats
    if (!userId) {
      return res.json({
        user_id: null,
        user: null,
        stats: { playing: 0, completed: 0, on_hold: 0, dropped: 0, planning: 0, wishlist: 0, total: 0 }
      });
    }

    const statsResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'playing') AS playing_count,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
        COUNT(*) FILTER (WHERE status = 'hold') AS hold_count,
        COUNT(*) FILTER (WHERE status = 'dropped') AS dropped_count,
        COUNT(*) FILTER (WHERE status = 'planning') AS planning_count,
        COUNT(*) FILTER (WHERE status = 'wishlist') AS wishlist_count,
        COUNT(*) AS total_games
       FROM user_games
       WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    res.json({
      user_id: userId,
      user: userRecord,
      stats: {
        playing: parseInt(stats.playing_count || 0),
        completed: parseInt(stats.completed_count || 0),
        on_hold: parseInt(stats.hold_count || 0),
        dropped: parseInt(stats.dropped_count || 0),
        planning: parseInt(stats.planning_count || 0),
        wishlist: parseInt(stats.wishlist_count || 0),
        total: parseInt(stats.total_games || 0),
      }
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/user/list - Get user's game list
// Supports: ?status=playing|completed|hold|dropped|planning
//           ?wishlist=true
// ------------------------------------------
router.get('/list', async (req, res, next) => {
  try {
    const userId = getUserId(req);

    // If no valid user, return empty list
    if (!userId) {
      return res.json({ count: 0, games: [] });
    }

    const { status } = req.query;

    let whereClauses = ['ug.user_id = $1'];
    let params = [userId];
    let paramIndex = 2;

    if (status) {
      whereClauses.push(`ug.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereSQL = 'WHERE ' + whereClauses.join(' AND ');

    const result = await query(
      `SELECT
        ug.id AS user_game_id,
        ug.status,
        ug.user_rating,
        ug.notes,
        g.id AS game_id,
        g.rawg_id,
        g.title,
        g.slug,
        g.background_image,
        g.rating,
        g.metacritic,
        g.released,
        g.playtime,
        COALESCE(
          (SELECT json_agg(json_build_object('id', gen.id, 'name', gen.name))
           FROM game_genres gg JOIN genres gen ON gg.genre_id = gen.id
           WHERE gg.game_id = g.id), '[]'::json
        ) AS genres,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name))
           FROM game_platforms gp JOIN platforms pl ON gp.platform_id = pl.id
           WHERE gp.game_id = g.id), '[]'::json
        ) AS platforms
      FROM user_games ug
      JOIN games g ON ug.game_id = g.id
      ${whereSQL}
      ORDER BY ug.id DESC`,
      params
    );

    res.json({
      count: result.rows.length,
      games: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// PUT /api/user/list/:gameId - Add/update game in user list
// Body: { status, wishlist, user_rating, notes }
// ------------------------------------------
router.put('/list/:gameId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to update game list' });
    }

    const gameId = parseInt(req.params.gameId);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    // Check if game exists
    const gameExists = await query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameExists.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const { status, wishlist, user_rating, notes } = req.body;

    // Mutually exclusive statuses: 'wishlist' is just another status value
    // Support legacy clients that still send wishlist=true
    const finalStatus = status || (wishlist ? 'wishlist' : null);

    const result = await query(
      `INSERT INTO user_games (user_id, game_id, status, user_rating, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, game_id)
       DO UPDATE SET
         status = $3,
         user_rating = COALESCE($4, user_games.user_rating),
         notes = COALESCE($5, user_games.notes)
       RETURNING *`,
      [
        userId,
        gameId,
        finalStatus,
        user_rating || null,
        notes || null,
      ]
    );

    res.json({
      message: 'Game status updated',
      entry: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// DELETE /api/user/list/:gameId - Remove game from user list
// ------------------------------------------
router.delete('/list/:gameId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to modify game list' });
    }

    const gameId = parseInt(req.params.gameId);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const result = await query(
      `DELETE FROM user_games
       WHERE user_id = $1 AND game_id = $2
       RETURNING *`,
      [userId, gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found in user list' });
    }

    res.json({
      message: 'Game removed from list',
      gameId,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/user/favorites - Get user's favorite games
// Independent of My List (user_games)
// ------------------------------------------
router.get('/favorites', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.json({ count: 0, games: [] });
    }

    const result = await query(
      `SELECT
        uf.id AS favorite_id,
        g.id AS game_id,
        g.rawg_id,
        g.title,
        g.slug,
        g.background_image,
        g.rating,
        g.metacritic,
        g.released,
        g.playtime,
        COALESCE(
          (SELECT json_agg(json_build_object('id', gen.id, 'name', gen.name))
           FROM game_genres gg JOIN genres gen ON gg.genre_id = gen.id
           WHERE gg.game_id = g.id), '[]'::json
        ) AS genres,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name))
           FROM game_platforms gp JOIN platforms pl ON gp.platform_id = pl.id
           WHERE gp.game_id = g.id), '[]'::json
        ) AS platforms
      FROM user_favorites uf
      JOIN games g ON uf.game_id = g.id
      WHERE uf.user_id = $1
      ORDER BY uf.id DESC`,
      [userId]
    );

    res.json({
      count: result.rows.length,
      games: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// POST /api/user/favorites/:gameId - Add game to favorites
// ------------------------------------------
router.post('/favorites/:gameId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to add favorites' });
    }

    const gameId = parseInt(req.params.gameId);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const gameExists = await query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameExists.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    await query(
      `INSERT INTO user_favorites (user_id, game_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, game_id) DO NOTHING`,
      [userId, gameId]
    );

    res.json({
      message: 'Game added to favorites',
      gameId,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// DELETE /api/user/favorites/:gameId - Remove game from favorites
// ------------------------------------------
router.delete('/favorites/:gameId', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to remove favorites' });
    }

    const gameId = parseInt(req.params.gameId);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    await query(
      `DELETE FROM user_favorites
       WHERE user_id = $1 AND game_id = $2`,
      [userId, gameId]
    );

    res.json({
      message: 'Game removed from favorites',
      gameId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
