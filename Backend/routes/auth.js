// ==========================================
// Authentication Routes (Email & Password)
// ==========================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------
// POST /api/auth/register - Register new user
// Body: { username, email, password, avatar, bio, favoriteGenre }
// ------------------------------------------
router.post('/register', async (req, res, next) => {
  try {
    const {
      username,
      email,
      password,
      avatar = '🎮',
      bio = 'Passionate gamer discovering new worlds on MyGameList.',
      favoriteGenre = 'Action',
    } = req.body;

    // 1. Validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters long',
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: 'Please provide a valid email address',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 2. Check for existing user (case-insensitive)
    const existingCheck = await query(
      `SELECT id, username, email FROM users
       WHERE LOWER(email) = $1 OR LOWER(username) = $2`,
      [cleanEmail, cleanUsername.toLowerCase()]
    );

    if (existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      if (match.email.toLowerCase() === cleanEmail) {
        return res.status(409).json({
          error: 'An account with this email address already exists',
        });
      }
      if (match.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(409).json({
          error: 'This gamer tag / username is already taken',
        });
      }
    }

    // 3. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Insert into database
    const insertResult = await query(
      `INSERT INTO users (username, email, password_hash, avatar, bio, favorite_genre)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, avatar, bio, favorite_genre, created_at`,
      [cleanUsername, cleanEmail, passwordHash, avatar, bio, favoriteGenre]
    );

    const newUser = insertResult.rows[0];

    // 5. Generate JWT token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.username,
        avatar: newUser.avatar,
        bio: newUser.bio,
        favoriteGenre: newUser.favorite_genre,
        createdAt: newUser.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// POST /api/auth/login - Login with Email/Username & Password
// Body: { emailOrUser (or email), password }
// ------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { emailOrUser, email, password } = req.body;
    const identifier = (emailOrUser || email || '').trim();

    // 1. Validation
    if (!identifier) {
      return res.status(400).json({
        error: 'Please enter your email or gamer tag',
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Please enter your password',
      });
    }

    // 2. Find user in database
    const userResult = await query(
      `SELECT id, username, email, password_hash, avatar, bio, favorite_genre, created_at
       FROM users
       WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
      [identifier.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials. User not found.',
      });
    }

    const user = userResult.rows[0];

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials. Incorrect password.',
      });
    }

    // 4. Generate JWT token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.username,
        avatar: user.avatar,
        bio: user.bio,
        favoriteGenre: user.favorite_genre,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/auth/me - Get current logged-in user details
// Header: Authorization: Bearer <token>
// ------------------------------------------
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const userResult = await query(
      `SELECT id, username, email, avatar, bio, favorite_genre, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User account not found',
      });
    }

    const user = userResult.rows[0];

    // Also fetch their game count summary
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
      [user.id]
    );

    const stats = statsResult.rows[0] || {};

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.username,
        avatar: user.avatar,
        bio: user.bio,
        favoriteGenre: user.favorite_genre,
        createdAt: user.created_at,
      },
      stats: {
        playing: parseInt(stats.playing_count || 0),
        completed: parseInt(stats.completed_count || 0),
        on_hold: parseInt(stats.hold_count || 0),
        dropped: parseInt(stats.dropped_count || 0),
        planning: parseInt(stats.planning_count || 0),
        wishlist: parseInt(stats.wishlist_count || 0),
        total: parseInt(stats.total_games || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// PUT /api/auth/profile - Update user profile
// Header: Authorization: Bearer <token>
// Body: { avatar, bio, favoriteGenre, username }
// ------------------------------------------
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { avatar, bio, favoriteGenre, username } = req.body;

    // Optional username update validation
    if (username) {
      const cleanUsername = username.trim();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      const conflictCheck = await query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2`,
        [cleanUsername, req.user.id]
      );
      if (conflictCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This gamer tag is already taken' });
      }
    }

    const result = await query(
      `UPDATE users
       SET
         username = COALESCE($1, username),
         avatar = COALESCE($2, avatar),
         bio = COALESCE($3, bio),
         favorite_genre = COALESCE($4, favorite_genre),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, username, email, avatar, bio, favorite_genre, updated_at`,
      [username?.trim() || null, avatar || null, bio || null, favoriteGenre || null, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        name: updated.username,
        avatar: updated.avatar,
        bio: updated.bio,
        favoriteGenre: updated.favorite_genre,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
