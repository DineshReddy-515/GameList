// ==========================================
// RAWG Full Database Ingestion Engine
// High-efficiency, resumeable, pagination-driven synchronization
// 1 API Request = 40 Complete Games (RAWG Maximum Batch Size)
// ==========================================
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient, query } from './pool.js';
import { initializeDatabase } from './schema.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';
const STATE_FILE = path.join(__dirname, 'sync_state.json');
const JOB_NAME = 'rawg_full_import';

if (!RAWG_API_KEY || RAWG_API_KEY === 'YOUR_RAWG_API_KEY_HERE') {
  console.error('❌ RAWG_API_KEY is not configured in Backend/.env!');
  process.exit(1);
}

// In-memory caches to eliminate redundant DB lookups for genres & platforms
const genreCache = new Map();
const platformCache = new Map();

// Global counters for the active session
let sessionApiCalls = 0;
let sessionGamesIngested = 0;
let isShuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// URL Helper: Ensure HTTPS & API Key
// ==========================================
function normalizeRawgUrl(rawUrl, apiKey) {
  if (!rawUrl) return null;
  let urlStr = rawUrl;
  if (urlStr.startsWith('http://')) {
    urlStr = 'https://' + urlStr.slice(7);
  }

  const urlObj = new URL(urlStr);
  if (!urlObj.searchParams.has('key')) {
    urlObj.searchParams.set('key', apiKey);
  }
  return urlObj.toString();
}

// ==========================================
// Load & Save Sync State (sync_state.json)
// ==========================================
async function loadSyncProgress(restart = false) {
  if (restart) {
    console.log('🔄 Restart requested. Resetting import progress...');
    const freshState = {
      currentPage: 1,
      nextUrl: null,
      totalApiCalls: 0,
      totalIngested: 0,
      status: 'in_progress',
      lastError: null,
      failures: [],
      lastUpdated: new Date().toISOString(),
    };
    saveFileState(freshState);

    return {
      jobName: JOB_NAME,
      currentUrl: null,
      nextUrl: null,
      pageNumber: 1,
      totalImported: 0,
      totalApiCalls: 0,
      status: 'in_progress',
    };
  }

  let fileState = null;
  try {
    if (fs.existsSync(STATE_FILE)) {
      fileState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    // Ignore file read error
  }

  const initialPage = fileState?.currentPage || 1;
  const initialImported = fileState?.totalIngested || 0;
  const initialCalls = fileState?.totalApiCalls || 0;
  let initialUrl = fileState?.nextUrl || null;

  if (!initialUrl && initialPage > 1) {
    initialUrl = `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&page=${initialPage}&page_size=40&ordering=-added`;
  }

  return {
    jobName: JOB_NAME,
    currentUrl: initialUrl,
    nextUrl: initialUrl,
    pageNumber: initialPage,
    totalImported: initialImported,
    totalApiCalls: initialCalls,
    status: fileState?.status || 'in_progress',
    lastError: fileState?.lastError || null,
  };
}

function persistBatchProgress(progress) {
  saveFileState({
    currentPage: progress.pageNumber,
    nextUrl: progress.nextUrl,
    totalApiCalls: progress.totalApiCalls,
    totalIngested: progress.totalImported,
    status: progress.status || 'in_progress',
    lastError: progress.lastError || null,
    lastUpdated: new Date().toISOString(),
  });
}

function saveFileState(state) {
  try {
    let existing = {};
    if (fs.existsSync(STATE_FILE)) {
      existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...existing, ...state }, null, 2), 'utf8');
  } catch (err) {
    // Non-blocking file backup warning
  }
}

// ==========================================
// Record Failed Pages in sync_state.json
// ==========================================
function recordPageFailure(url, pageNumber, errorMessage, retryCount = 5) {
  try {
    let existing = {};
    if (fs.existsSync(STATE_FILE)) {
      existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    const failures = Array.isArray(existing.failures) ? existing.failures : [];
    failures.push({
      url,
      pageNumber,
      errorMessage,
      retryCount,
      timestamp: new Date().toISOString(),
    });
    saveFileState({ failures, lastError: errorMessage, status: 'error' });
  } catch (err) {
    console.error('⚠️ Could not log failure to sync_state.json:', err.message);
  }
}

// ==========================================
// HTTP Fetch with Exponential Backoff
// ==========================================
async function fetchWithRetry(url, retries = 5, initialDelay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      sessionApiCalls++;
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited — exponential backoff
        const waitTime = initialDelay * (i + 2);
        console.log(`\n⏳ Rate limited (HTTP 429). Waiting ${(waitTime / 1000).toFixed(1)}s before retry ${i + 1}/${retries}...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText}${errText ? `: ${errText.slice(0, 150)}` : ''}`);
      }

      const json = await response.json();
      return json;
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      const waitTime = initialDelay * (i + 1);
      console.log(`\n⚠️ Retry ${i + 1}/${retries} for page fetch. Waiting ${(waitTime / 1000).toFixed(1)}s... Error: ${err.message}`);
      await sleep(waitTime);
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

function parseReleaseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null;
  return dateStr;
}

function parseRating(rating) {
  const num = parseFloat(rating);
  if (isNaN(num) || num < 0) return 0;
  if (num > 5.0) return 5.0;
  return Math.round(num * 100) / 100;
}

// ==========================================
// Insert Game & Relationships with ON CONFLICT DO UPDATE
// ==========================================
async function insertGame(client, game) {
  const released = parseReleaseDate(game.released);
  const rating = parseRating(game.rating);
  const title = (game.name || 'Untitled').slice(0, 500);
  const slug = (game.slug || '').slice(0, 500);
  const esrbRating = game.esrb_rating?.name ? game.esrb_rating.name.slice(0, 50) : null;
  const additionalImg = game.short_screenshots?.[1]?.image || null;

  // Insert or update game row with complete conflict handling
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

  // Insert genre relationships
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

  // Insert platform relationships
  if (Array.isArray(game.platforms) && game.platforms.length > 0) {
    for (const p of game.platforms) {
      const pName = p.platform?.name || p.name;
      const pSlug = p.platform?.slug || p.slug;
      if (pName) {
        const platformId = await getOrUpsertPlatform(client, pName, pSlug);
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
// Status Display Helper
// ==========================================
async function printStatus() {
  const dbCount = await query('SELECT COUNT(*) as total_games, COUNT(DISTINCT rawg_id) as unique_rawg FROM games');

  let fileState = null;
  try {
    if (fs.existsSync(STATE_FILE)) {
      fileState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    // ignore
  }

  console.log('\n📊 ======================================================');
  console.log('   GameList Database & Ingestion Status');
  console.log('========================================================');
  console.log(`🎮 Total Games in DB:      ${dbCount.rows[0].total_games}`);
  console.log(`🔑 Unique RAWG IDs:        ${dbCount.rows[0].unique_rawg}`);

  if (fileState) {
    console.log(`📍 Current Page:           ${fileState.currentPage || 1}`);
    console.log(`📥 Total Ingested (Job):   ${fileState.totalIngested || 0}`);
    console.log(`🌐 Total API Calls:        ${fileState.totalApiCalls || 0}`);
    console.log(`🚦 Job Status:             ${fileState.status || 'unknown'}`);
    console.log(`🔗 Next URL:               ${fileState.nextUrl ? fileState.nextUrl.slice(0, 80) + '...' : 'None (at end)'}`);
    console.log(`🕒 Last Updated:           ${fileState.lastUpdated || 'N/A'}`);
    const failures = Array.isArray(fileState.failures) ? fileState.failures : [];
    console.log(`⚠️  Total Failures:         ${failures.length}`);
  } else {
    console.log('📍 Import Progress:        No import job recorded yet');
  }
  console.log('========================================================\n');
}

// ==========================================
// Main Ingestion Worker
// ==========================================
async function runSync() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  // Command-line flag parsing
  const isStatusOnly = args.includes('--status');
  const shouldRestart = args.includes('--restart') || args.includes('--reset');
  const continueOnError = args.includes('--continue-on-error');
  const pagesArg = args.find((a) => a.startsWith('--pages=') || a.startsWith('--limit='));
  const maxPages = pagesArg ? parseInt(pagesArg.split('=')[1]) : Infinity;

  // 1. Ensure database tables exist
  await initializeDatabase();

  if (isStatusOnly) {
    await printStatus();
    process.exit(0);
  }

  console.log('⚡ ======================================================');
  console.log('   RAWG Continuous Database Ingestor');
  console.log('   Pagination Mode: Full `next` Link Traversal');
  console.log('   Maximum Batch Size: 40 Games per 1 API Call');
  console.log('========================================================\n');

  // Pre-load caches
  const existingGenres = await query('SELECT id, name FROM genres');
  existingGenres.rows.forEach((r) => genreCache.set(r.name, r.id));

  const existingPlatforms = await query('SELECT id, name FROM platforms');
  existingPlatforms.rows.forEach((r) => platformCache.set(r.name, r.id));

  const client = await getClient();

  // Load progress from sync_state.json
  const state = await loadSyncProgress(shouldRestart);

  // Determine starting URL
  let currentUrl = state.nextUrl;
  if (!currentUrl) {
    currentUrl = `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&page_size=40&ordering=-added`;
    if (state.pageNumber > 1) {
      currentUrl += `&page=${state.pageNumber}`;
    }
  }
  currentUrl = normalizeRawgUrl(currentUrl, RAWG_API_KEY);

  let pageIndex = state.pageNumber;
  let totalImported = state.totalImported;
  let totalApiCalls = state.totalApiCalls;
  let pagesProcessedThisSession = 0;

  console.log(`📍 Resuming Import:`);
  console.log(`   Page:              ${pageIndex}`);
  console.log(`   Previously Saved:  ${totalImported} games`);
  console.log(`   API Calls So Far:  ${totalApiCalls}`);
  console.log(`   Target:            ${maxPages === Infinity ? 'ALL accessible games (complete catalog)' : `${maxPages} pages (${maxPages * 40} games max)`}`);
  console.log(`   Starting URL:      ${currentUrl.slice(0, 90)}...\n`);

  // Handle graceful shutdown on Ctrl+C (SIGINT) and kill (SIGTERM)
  const handleGracefulShutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n\n🛑 Pause requested. Finalizing current batch and saving state...');
    try {
      saveFileState({ status: 'paused', lastUpdated: new Date().toISOString() });
      console.log(`💾 Progress saved safely at Page ${pageIndex}!`);
      console.log(`▶️  To resume later, simply run: npm run sync\n`);
    } catch (e) {
      // Ignore on exit
    } finally {
      client.release();
      process.exit(0);
    }
  };

  process.on('SIGINT', handleGracefulShutdown);
  process.on('SIGTERM', handleGracefulShutdown);

  try {
    while (currentUrl && !isShuttingDown) {
      if (pagesProcessedThisSession >= maxPages) {
        console.log(`\n🎯 Reached requested page limit (${maxPages} pages). Ingestion paused.`);
        break;
      }

      currentUrl = normalizeRawgUrl(currentUrl, RAWG_API_KEY);
      let pageData;

      try {
        pageData = await fetchWithRetry(currentUrl, 5, 1500);
      } catch (fetchErr) {
        console.error(`\n❌ Failed to fetch page ${pageIndex} after 5 retries: ${fetchErr.message}`);
        recordPageFailure(currentUrl, pageIndex, fetchErr.message);

        if (!continueOnError) {
          console.error(`\n🛑 Halting import to prevent missing data. Run 'npm run sync' to resume.`);
          break;
        } else {
          console.warn(`⚠️ --continue-on-error enabled. Skipping page ${pageIndex} and attempting next.`);
          // If we have to skip without next URL, we increment page
          pageIndex++;
          currentUrl = `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&page=${pageIndex}&page_size=40&ordering=-added`;
          continue;
        }
      }

      const results = pageData.results || [];
      if (results.length === 0) {
        console.log(`\n🏁 Reached the end of accessible RAWG games catalog at page ${pageIndex}!`);
        saveFileState({ status: 'completed', nextUrl: null, lastUpdated: new Date().toISOString() });
        break;
      }

      // Atomic Transaction for the batch of 40 games
      await client.query('BEGIN');
      try {
        for (const game of results) {
          await insertGame(client, game);
        }

        const nextRawUrl = pageData.next;
        const normalizedNext = nextRawUrl ? normalizeRawgUrl(nextRawUrl, RAWG_API_KEY) : null;

        totalImported += results.length;
        totalApiCalls++;
        sessionGamesIngested += results.length;
        pagesProcessedThisSession++;

        persistBatchProgress({
          currentUrl,
          nextUrl: normalizedNext,
          pageNumber: pageIndex + 1,
          batchCount: results.length,
          totalImported,
          totalApiCalls,
          status: normalizedNext ? 'in_progress' : 'completed',
        });

        await client.query('COMMIT');

        // Log progress every 5 pages or on first page
        if (pagesProcessedThisSession === 1 || pagesProcessedThisSession % 5 === 0 || !normalizedNext) {
          const totalInDb = await query('SELECT COUNT(*) as count FROM games');
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(
            `📦 Page ${pageIndex} (${results.length} games) | +${sessionGamesIngested} this session | ${totalInDb.rows[0].count} total in DB | Next: ${normalizedNext ? 'Yes' : 'None (End)'} | ${elapsed}s elapsed`
          );
        }

        pageIndex++;
        currentUrl = normalizedNext;

        // If next is null, we reached the end of RAWG's available pages!
        if (!currentUrl) {
          console.log(`\n🎉 Reached end of RAWG pagination: 'next' is null.`);
          saveFileState({ status: 'completed', nextUrl: null, lastUpdated: new Date().toISOString() });
          break;
        }

        // Polite delay (250ms) to respect rate limits (~4 req/sec, well under 5 req/sec limit)
        await sleep(250);
      } catch (insertErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`\n❌ Error committing batch for page ${pageIndex}:`, insertErr.message);
        recordPageFailure(currentUrl, pageIndex, insertErr.message);
        break;
      }
    }
  } finally {
    client.release();
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  const dbCount = await query('SELECT COUNT(*) as total_games, COUNT(DISTINCT rawg_id) as unique_rawg FROM games');

  console.log('\n======================================================');
  console.log('🎉 Ingestion Session Summary');
  console.log('======================================================');
  console.log(`⏱️  Elapsed Time:          ${elapsedSeconds} seconds`);
  console.log(`🌐 API Calls Used:        ${sessionApiCalls} requests`);
  console.log(`📥 Games Ingested Now:    +${sessionGamesIngested} games`);
  console.log(`💾 Total Games in DB:      ${dbCount.rows[0].total_games} games`);
  console.log(`🔑 Unique RAWG IDs:       ${dbCount.rows[0].unique_rawg} (0 duplicates)`);
  console.log(`📍 Current Page:          Page ${pageIndex}`);
  console.log('======================================================\n');
}

runSync().catch((err) => {
  console.error('❌ Fatal sync error:', err);
  process.exit(1);
});
