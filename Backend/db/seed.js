// ==========================================
// Optimal RAWG API Database Seeder
// High-efficiency batch ingestion covering all eras till present (2026)
// Preserves free tier API limits: 1 API call = 40 complete games
// ==========================================
import dotenv from 'dotenv';
import { getClient, query } from './pool.js';
import { initializeDatabase, resetDatabase } from './schema.js';

dotenv.config();

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';

if (!RAWG_API_KEY || RAWG_API_KEY === 'YOUR_RAWG_API_KEY_HERE') {
  console.error('❌ RAWG_API_KEY is not set in .env file!');
  console.error('   Please provide your free API key in Backend/.env');
  process.exit(1);
}

// In-memory caches to eliminate redundant DB lookups for genres & platforms
const genreCache = new Map();
const platformCache = new Map();

// Global API call counter
let totalApiCallsMade = 0;

// ==========================================
// Helpers: Sleep & Fetch with Retry
// ==========================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      totalApiCallsMade++;
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited — back off and retry
        const waitTime = delay * (i + 2);
        console.log(`⏳ Rate limited (HTTP 429). Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`⚠️  Retry ${i + 1}/${retries} for ${url.split('?')[0]}...`);
      await sleep(delay * (i + 1));
    }
  }
}

// ==========================================
// Upsert Genre (cached in-memory)
// ==========================================
async function getOrUpsertGenre(client, name, slug) {
  if (!name) return null;
  const cleanName = name.trim().slice(0, 100);
  if (genreCache.has(cleanName)) {
    return genreCache.get(cleanName);
  }

  const result = await client.query(
    `INSERT INTO genres (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [cleanName, slug ? slug.slice(0, 100) : cleanName.toLowerCase().replace(/\s+/g, '-')]
  );
  const id = result.rows[0].id;
  genreCache.set(cleanName, id);
  return id;
}

// ==========================================
// Upsert Platform (cached in-memory)
// ==========================================
async function getOrUpsertPlatform(client, name, slug) {
  if (!name) return null;
  const cleanName = name.trim().slice(0, 150);
  if (platformCache.has(cleanName)) {
    return platformCache.get(cleanName);
  }

  const result = await client.query(
    `INSERT INTO platforms (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`,
    [cleanName, slug ? slug.slice(0, 150) : cleanName.toLowerCase().replace(/\s+/g, '-')]
  );
  const id = result.rows[0].id;
  platformCache.set(cleanName, id);
  return id;
}

// ==========================================
// Safe Date Parser
// ==========================================
function parseReleaseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null;
  return dateStr;
}

// ==========================================
// Safe Rating Parser
// ==========================================
function parseRating(rating) {
  const num = parseFloat(rating);
  if (isNaN(num) || num < 0) return 0;
  if (num > 5.0) return 5.0;
  return Math.round(num * 100) / 100;
}

// ==========================================
// Insert / Update a Single Game & Junctions
// ==========================================
async function insertGameOptimally(client, game) {
  const released = parseReleaseDate(game.released);
  const rating = parseRating(game.rating);
  const title = (game.name || 'Untitled').slice(0, 500);
  const slug = (game.slug || '').slice(0, 500);
  const esrbRating = game.esrb_rating?.name ? game.esrb_rating.name.slice(0, 50) : null;
  const additionalImg = game.short_screenshots?.[1]?.image || null;

  // Insert or update game row
  const gameResult = await client.query(
    `INSERT INTO games (
       rawg_id, title, slug,
       released, background_image, background_image_additional,
       rating, rating_top, ratings_count, metacritic,
       playtime, esrb_rating,
       added, suggestions_count, reviews_count,
       saturated_color, dominant_color
     ) VALUES (
       $1, $2, $3,
       $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12,
       $13, $14, $15,
       $16, $17
     )
     ON CONFLICT (rawg_id) DO UPDATE SET
       title = EXCLUDED.title,
       slug = EXCLUDED.slug,
       released = COALESCE(EXCLUDED.released, games.released),
       background_image = COALESCE(EXCLUDED.background_image, games.background_image),
       background_image_additional = COALESCE(EXCLUDED.background_image_additional, games.background_image_additional),
       rating = EXCLUDED.rating,
       rating_top = EXCLUDED.rating_top,
       ratings_count = EXCLUDED.ratings_count,
       metacritic = COALESCE(EXCLUDED.metacritic, games.metacritic),
       playtime = EXCLUDED.playtime,
       esrb_rating = COALESCE(EXCLUDED.esrb_rating, games.esrb_rating),
       added = EXCLUDED.added,
       suggestions_count = EXCLUDED.suggestions_count,
       reviews_count = EXCLUDED.reviews_count,
       saturated_color = COALESCE(EXCLUDED.saturated_color, games.saturated_color),
       dominant_color = COALESCE(EXCLUDED.dominant_color, games.dominant_color)
     RETURNING id`,
    [
      game.id,
      title,
      slug,
      released,
      game.background_image || null,
      additionalImg,
      rating,
      parseInt(game.rating_top) || 0,
      parseInt(game.ratings_count) || 0,
      game.metacritic ? parseInt(game.metacritic) : null,
      parseInt(game.playtime) || 0,
      esrbRating,
      parseInt(game.added) || 0,
      parseInt(game.suggestions_count) || 0,
      parseInt(game.reviews_count) || 0,
      game.saturated_color ? game.saturated_color.slice(0, 20) : null,
      game.dominant_color ? game.dominant_color.slice(0, 20) : null,
    ]
  );

  const gameId = gameResult.rows[0].id;

  // Link genres
  if (Array.isArray(game.genres) && game.genres.length > 0) {
    for (const genre of game.genres) {
      if (genre && genre.name) {
        const genreId = await getOrUpsertGenre(client, genre.name, genre.slug);
        if (genreId) {
          await client.query(
            `INSERT INTO game_genres (game_id, genre_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [gameId, genreId]
          );
        }
      }
    }
  }

  // Link platforms
  if (Array.isArray(game.platforms) && game.platforms.length > 0) {
    for (const p of game.platforms) {
      const platformName = p.platform?.name || p.name;
      const platformSlug = p.platform?.slug || p.slug;
      if (platformName) {
        const platformId = await getOrUpsertPlatform(client, platformName, platformSlug);
        if (platformId) {
          await client.query(
            `INSERT INTO game_platforms (game_id, platform_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [gameId, platformId]
          );
        }
      }
    }
  }

  return gameId;
}

// ==========================================
// Seed Category (Paginated list requests)
// ==========================================
async function seedCategory(client, label, urlBuilder, totalPages = 5) {
  console.log(`\n======================================================`);
  console.log(`🎮 [Category] ${label}`);
  console.log(`   Targeting ${totalPages} pages (up to ${totalPages * 40} games)...`);
  console.log(`======================================================`);

  let categoryGamesCount = 0;

  for (let page = 1; page <= totalPages; page++) {
    const url = urlBuilder(page);
    try {
      const data = await fetchWithRetry(url);
      if (!data.results || data.results.length === 0) {
        console.log(`   Page ${page}: No more games found. Moving to next category.`);
        break;
      }

      await client.query('BEGIN');
      for (const game of data.results) {
        await insertGameOptimally(client, game);
      }
      await client.query('COMMIT');

      categoryGamesCount += data.results.length;
      console.log(`   ✅ Page ${page}/${totalPages} processed (${data.results.length} games) | Total Category: ${categoryGamesCount}`);

      // Polite delay between API calls to honor rate limits
      await sleep(250);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`   ❌ Failed page ${page}:`, err.message);
      // Wait a moment and continue with next page
      await sleep(500);
    }
  }

  return categoryGamesCount;
}

// ==========================================
// Seed Trending Games List
// ==========================================
async function seedTrendingGames(client) {
  console.log('\n🔥 Updating Trending Games Rankings...');
  const url = `${RAWG_BASE_URL}/games/lists/main?key=${RAWG_API_KEY}&ordering=-relevance&page_size=40`;

  try {
    const data = await fetchWithRetry(url);
    if (!data.results) return;

    await client.query('BEGIN');
    await client.query('DELETE FROM trending_games');

    for (let i = 0; i < data.results.length; i++) {
      const game = data.results[i];
      const gameId = await insertGameOptimally(client, game);

      await client.query(
        `INSERT INTO trending_games (game_id, rank)
         VALUES ($1, $2)
         ON CONFLICT (game_id) DO UPDATE SET rank = EXCLUDED.rank`,
        [gameId, i + 1]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${data.results.length} trending games into ranking list!`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error updating trending games:', err.message);
  }
}

// ==========================================
// Main Optimal Seeder Function
// ==========================================
async function seed() {
  const startTime = Date.now();

  console.log('🌱 ======================================================');
  console.log('   GameList RAWG Optimal Database Sync');
  console.log('   Preserving Free Trial API Quota (1 API call = 40 games)');
  console.log('   Target: Games across all eras till present now (2026)');
  console.log('========================================================\n');

  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');

  // Parse custom pages if provided: --pages=X
  const pagesArg = args.find(a => a.startsWith('--pages='));
  const basePages = pagesArg ? parseInt(pagesArg.split('=')[1]) : 12;

  if (shouldReset) {
    console.log('🗑️  Resetting database schema...');
    await resetDatabase();
  }

  // 1. Initialize DB schema
  await initializeDatabase();

  // 2. Pre-populate caches with existing DB records
  const existingGenres = await query('SELECT id, name FROM genres');
  existingGenres.rows.forEach(r => genreCache.set(r.name, r.id));

  const existingPlatforms = await query('SELECT id, name FROM platforms');
  existingPlatforms.rows.forEach(r => platformCache.set(r.name, r.id));

  console.log(`📦 Loaded existing caches: ${genreCache.size} genres, ${platformCache.size} platforms in DB.`);

  // 3. Define multi-era categories to cover history up to present (2026)
  const categories = [
    {
      label: 'Present & Recent Releases (2025 - Present 2026)',
      pages: basePages,
      urlBuilder: page =>
        `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&dates=2025-01-01,2026-12-31&ordering=-added&page_size=40&page=${page}`,
    },
    {
      label: 'Modern Era Blockbusters (2023 - 2024)',
      pages: basePages,
      urlBuilder: page =>
        `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&dates=2023-01-01,2024-12-31&ordering=-added&page_size=40&page=${page}`,
    },
    {
      label: 'All-Time Most Popular (All Eras)',
      pages: Math.min(basePages + 3, 20),
      urlBuilder: page =>
        `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&ordering=-added&page_size=40&page=${page}`,
    },
    {
      label: 'All-Time Highest Metacritic Acclaim',
      pages: basePages,
      urlBuilder: page =>
        `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&ordering=-metacritic&page_size=40&page=${page}`,
    },
    {
      label: 'Classic Masterpieces & Discoveries (1995 - 2022)',
      pages: Math.max(Math.floor(basePages * 0.8), 5),
      urlBuilder: page =>
        `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&dates=1995-01-01,2022-12-31&ordering=-rating&metacritic=75,100&page_size=40&page=${page}`,
    },
  ];

  const client = await getClient();
  let totalProcessed = 0;

  try {
    for (const cat of categories) {
      const count = await seedCategory(client, cat.label, cat.urlBuilder, cat.pages);
      totalProcessed += count;
    }

    // 4. Update Trending Rankings
    await seedTrendingGames(client);
  } finally {
    client.release();
  }

  // 5. Final Statistics
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const counts = await getTableCounts();

  console.log('\n======================================================');
  console.log('🎉 Sync & Ingestion Complete!');
  console.log('======================================================');
  console.log(`⏱️  Elapsed Time:       ${elapsedSeconds} seconds`);
  console.log(`🌐 Total API Calls:     ${totalApiCallsMade} (RAWG Free Tier safe!)`);
  console.log(`⚡ API Quota Used:      ~${((totalApiCallsMade / 20000) * 100).toFixed(2)}% of 20,000 monthly limit`);
  console.log(`🎮 Total Game Records:  ${counts.games} games in database`);
  console.log(`🏷️  Genres Populated:    ${counts.genres}`);
  console.log(`💻 Platforms Populated: ${counts.platforms}`);
  console.log(`🔥 Trending Tracked:    ${counts.trending}`);
  console.log('======================================================\n');

  process.exit(0);
}

async function getTableCounts() {
  const [games, genres, platforms, trending] = await Promise.all([
    query('SELECT COUNT(*) FROM games'),
    query('SELECT COUNT(*) FROM genres'),
    query('SELECT COUNT(*) FROM platforms'),
    query('SELECT COUNT(*) FROM trending_games'),
  ]);

  return {
    games: games.rows[0].count,
    genres: genres.rows[0].count,
    platforms: platforms.rows[0].count,
    trending: trending.rows[0].count,
  };
}

// Execute
seed().catch(err => {
  console.error('❌ Fatal error during sync:', err);
  process.exit(1);
});
