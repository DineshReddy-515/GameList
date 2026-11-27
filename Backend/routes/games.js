// ==========================================
// Games Routes - PostgreSQL backed
// ==========================================
import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// ------------------------------------------
// GET /api/games - List games with filters
// Supports: ?search=, ?genre=, ?platform=, ?sort=, ?page=, ?page_size=
// ------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      genre,
      platform,
      sort,
      page = 1,
      page_size = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limit = Math.min(100, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * limit;

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    // Search filter (matches from the start of any word in title, genres, or platforms)
    if (search) {
      whereClauses.push(`(
        g.title ILIKE $${paramIndex}
        OR g.title ~* $${paramIndex + 1}
        OR EXISTS (
          SELECT 1 FROM game_genres gg2
          JOIN genres gen2 ON gg2.genre_id = gen2.id
          WHERE gg2.game_id = g.id AND (
            gen2.name ILIKE $${paramIndex}
            OR gen2.name ~* $${paramIndex + 1}
          )
        )
        OR EXISTS (
          SELECT 1 FROM game_platforms gp2
          JOIN platforms pl2 ON gp2.platform_id = pl2.id
          WHERE gp2.game_id = g.id AND (
            pl2.name ILIKE $${paramIndex}
            OR pl2.name ~* $${paramIndex + 1}
          )
        )
      )`);
      // $paramIndex  = starts-with the whole string (e.g. "act" -> "act%")
      // $paramIndex+1 = starts-with any word boundary (e.g. "act" -> regex "\\mact")
      params.push(`${search}%`);
      params.push(`\\m${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      paramIndex += 2;
    }

    // Genre filter
    if (genre && genre !== 'All Genres') {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM game_genres gg
          JOIN genres gen ON gg.genre_id = gen.id
          WHERE gg.game_id = g.id AND gen.name ILIKE $${paramIndex}
        )
      `);
      params.push(genre);
      paramIndex++;
    }

    // Platform filter
    if (platform) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM game_platforms gp
          JOIN platforms pl ON gp.platform_id = pl.id
          WHERE gp.game_id = g.id AND pl.name ILIKE $${paramIndex}
        )
      `);
      params.push(`%${platform}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length > 0
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';

    // Sorting
    let orderSQL = 'ORDER BY g.rating DESC NULLS LAST, g.id';
    if (sort === 'rating') orderSQL = 'ORDER BY g.rating DESC NULLS LAST';
    else if (sort === 'title') orderSQL = 'ORDER BY g.title ASC';
    else if (sort === 'released') orderSQL = 'ORDER BY g.released DESC NULLS LAST';
    else if (sort === 'metacritic') orderSQL = 'ORDER BY g.metacritic DESC NULLS LAST';
    else if (sort === 'added') orderSQL = 'ORDER BY g.added DESC';

    // Count total
    const countResult = await query(
      `SELECT COUNT(DISTINCT g.id) FROM games g ${whereSQL}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Fetch games
    const gamesResult = await query(
      `SELECT
        g.id, g.rawg_id, g.title, g.slug, g.description_raw AS description,
        g.released, g.background_image, g.background_image_additional,
        g.rating, g.rating_top, g.ratings_count, g.metacritic,
        g.playtime, g.esrb_rating, g.added,
        COALESCE(
          (SELECT json_agg(json_build_object('id', gen.id, 'name', gen.name, 'slug', gen.slug))
           FROM game_genres gg JOIN genres gen ON gg.genre_id = gen.id
           WHERE gg.game_id = g.id),
          '[]'::json
        ) AS genres,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name, 'slug', pl.slug))
           FROM game_platforms gp JOIN platforms pl ON gp.platform_id = pl.id
           WHERE gp.game_id = g.id),
          '[]'::json
        ) AS platforms
      FROM games g
      ${whereSQL}
      ${orderSQL}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      count: totalCount,
      page: pageNum,
      page_size: limit,
      total_pages: Math.ceil(totalCount / limit),
      games: gamesResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/games/genres - List all genres
// ------------------------------------------
router.get('/genres', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT g.id, g.name, g.slug, COUNT(gg.game_id) AS game_count
       FROM genres g
       LEFT JOIN game_genres gg ON g.id = gg.genre_id
       GROUP BY g.id, g.name, g.slug
       ORDER BY game_count DESC, g.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/games/platforms - List all platforms
// ------------------------------------------
router.get('/platforms', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.slug, COUNT(gp.game_id) AS game_count
       FROM platforms p
       LEFT JOIN game_platforms gp ON p.id = gp.platform_id
       GROUP BY p.id, p.name, p.slug
       ORDER BY game_count DESC, p.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// GET /api/games/trending - Trending games
// ------------------------------------------
router.get('/trending', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
        g.id, g.rawg_id, g.title, g.slug, g.description_raw AS description,
        g.released, g.background_image, g.background_image_additional,
        g.rating, g.rating_top, g.ratings_count, g.metacritic,
        g.playtime, g.esrb_rating, g.added,
        t.rank AS trending_rank,
        COALESCE(
          (SELECT json_agg(json_build_object('id', gen.id, 'name', gen.name, 'slug', gen.slug))
           FROM game_genres gg JOIN genres gen ON gg.genre_id = gen.id
           WHERE gg.game_id = g.id),
          '[]'::json
        ) AS genres,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name, 'slug', pl.slug))
           FROM game_platforms gp JOIN platforms pl ON gp.platform_id = pl.id
           WHERE gp.game_id = g.id),
          '[]'::json
        ) AS platforms
      FROM trending_games t
      JOIN games g ON t.game_id = g.id
      ORDER BY t.rank ASC`
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
// GET /api/games/:id - Game details by ID
// ------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const gameId = parseInt(req.params.id);
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const result = await query(
      `SELECT
        g.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', gen.id, 'name', gen.name, 'slug', gen.slug))
           FROM game_genres gg JOIN genres gen ON gg.genre_id = gen.id
           WHERE gg.game_id = g.id),
          '[]'::json
        ) AS genres,
        COALESCE(
          (SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name, 'slug', pl.slug))
           FROM game_platforms gp JOIN platforms pl ON gp.platform_id = pl.id
           WHERE gp.game_id = g.id),
          '[]'::json
        ) AS platforms,
        (SELECT rank FROM trending_games WHERE game_id = g.id) AS trending_rank
      FROM games g
      WHERE g.id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    let game = result.rows[0];

    // Lazy load full details from RAWG only if description is empty, caching it permanently in PostgreSQL
    if ((!game.description_raw || game.description_raw.trim() === '') && game.rawg_id && process.env.RAWG_API_KEY) {
      try {
        const rawgRes = await fetch(`https://api.rawg.io/api/games/${game.rawg_id}?key=${process.env.RAWG_API_KEY}`);
        if (rawgRes.ok) {
          const details = await rawgRes.json();
          const desc = details.description || '';
          const descRaw = details.description_raw || details.description || '';
          const website = details.website || null;
          const redditUrl = details.reddit_url || null;
          const extraImg = details.background_image_additional || null;

          await query(
            `UPDATE games SET
               description = COALESCE(NULLIF($1, ''), description),
               description_raw = COALESCE(NULLIF($2, ''), description_raw),
               website = COALESCE($3, website),
               reddit_url = COALESCE($4, reddit_url),
               background_image_additional = COALESCE($5, background_image_additional)
             WHERE id = $6`,
            [desc, descRaw, website, redditUrl, extraImg, game.id]
          );

          game.description = desc || game.description;
          game.description_raw = descRaw || game.description_raw;
          game.website = website || game.website;
          game.reddit_url = redditUrl || game.reddit_url;
          game.background_image_additional = extraImg || game.background_image_additional;
        }
      } catch (rawgErr) {
        // Fall back gracefully to existing record if RAWG API is unreachable
      }
    }

    res.json(game);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// POST /api/games - Add a new game manually
// ------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { title, description, released, background_image, rating, metacritic, genres, platforms } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Game title is required' });
    }

    const result = await query(
      `INSERT INTO games (title, description_raw, released, background_image, rating, metacritic)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || '', released || null, background_image || null, rating || 0, metacritic || null]
    );

    const gameId = result.rows[0].id;

    // Link genres
    if (Array.isArray(genres)) {
      for (const genreName of genres) {
        const genreResult = await query(
          `INSERT INTO genres (name, slug) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [genreName, genreName.toLowerCase().replace(/\s+/g, '-')]
        );
        await query(
          `INSERT INTO game_genres (game_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [gameId, genreResult.rows[0].id]
        );
      }
    }

    // Link platforms
    if (Array.isArray(platforms)) {
      for (const platName of platforms) {
        const platResult = await query(
          `INSERT INTO platforms (name, slug) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [platName, platName.toLowerCase().replace(/\s+/g, '-')]
        );
        await query(
          `INSERT INTO game_platforms (game_id, platform_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [gameId, platResult.rows[0].id]
        );
      }
    }

    // Fetch the complete game with relations
    const fullGame = await query(
      `SELECT g.*,
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
      FROM games g WHERE g.id = $1`,
      [gameId]
    );

    res.status(201).json(fullGame.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
