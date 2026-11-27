// ==========================================
// Database Schema - All Tables
// Includes migrations for upgrading existing schemas
// ==========================================
import { query, getClient } from './pool.js';

/**
 * Initialize all database tables
 * Creates tables if they don't exist, preserving existing data
 * Runs migrations to upgrade existing schemas to latest format
 */
export async function initializeDatabase() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Enable pg_trgm extension for efficient ILIKE / regex text search
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Create reusable updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);

    // ------------------------------------------
    // 0. USERS table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        avatar VARCHAR(50) DEFAULT '🎮',
        bio TEXT DEFAULT '',
        favorite_genre VARCHAR(100) DEFAULT 'Action',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ------------------------------------------
    // 1. GENRES table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) UNIQUE
      );
    `);

    // ------------------------------------------
    // 2. PLATFORMS table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        slug VARCHAR(150) UNIQUE
      );
    `);

    // ------------------------------------------
    // 3. GAMES table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        rawg_id INTEGER UNIQUE,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500),
        description TEXT,
        description_raw TEXT,
        released DATE,
        background_image TEXT,
        background_image_additional TEXT,
        rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
        rating_top INTEGER DEFAULT 0,
        ratings_count INTEGER DEFAULT 0,
        metacritic INTEGER,
        playtime INTEGER DEFAULT 0,
        esrb_rating VARCHAR(50),
        website TEXT,
        reddit_url TEXT,
        added INTEGER DEFAULT 0,
        suggestions_count INTEGER DEFAULT 0,
        reviews_count INTEGER DEFAULT 0,
        saturated_color VARCHAR(20),
        dominant_color VARCHAR(20)
      );
    `);

    // ------------------------------------------
    // 4. GAME_GENRES junction table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_genres (
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
        PRIMARY KEY (game_id, genre_id)
      );
    `);

    // ------------------------------------------
    // 5. GAME_PLATFORMS junction table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_platforms (
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
        PRIMARY KEY (game_id, platform_id)
      );
    `);

    // ------------------------------------------
    // 6. TRENDING_GAMES table
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS trending_games (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE UNIQUE,
        rank INTEGER NOT NULL
      );
    `);

    // ------------------------------------------
    // 7. USER_GAMES table
    //     user_id is INTEGER FK → users(id)
    //     No separate wishlist column (wishlist is a status value)
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_games (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
        status VARCHAR(50) CHECK (status IN ('playing', 'completed', 'hold', 'dropped', 'planning', 'wishlist')),
        user_rating DECIMAL(3,2) CHECK (user_rating IS NULL OR (user_rating >= 0 AND user_rating <= 5)),
        notes TEXT,
        UNIQUE(user_id, game_id)
      );
    `);

    // ------------------------------------------
    // 8. USER_FAVORITES table
    //    Independent of user_games (My List)
    // ------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        UNIQUE(user_id, game_id)
      );
    `);

    // ==========================================
    // MIGRATIONS - Upgrade existing schemas
    // ==========================================
    await client.query(`
      DO $$
      BEGIN

        -- ── Migration 1: user_games.user_id VARCHAR → INTEGER + FK ──
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_games'
            AND column_name = 'user_id'
            AND data_type = 'character varying'
        ) THEN
          -- Migrate wishlist boolean → status before we drop the column
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_games' AND column_name = 'wishlist'
          ) THEN
            UPDATE user_games SET status = 'wishlist'
              WHERE wishlist = true AND (status IS NULL OR status = '');
          END IF;

          -- Remove rows with non-numeric user_id (e.g. 'default_user')
          DELETE FROM user_games WHERE user_id !~ '^[0-9]+$';

          -- Remove orphaned rows whose user_id doesn't match any real user
          DELETE FROM user_games
            WHERE user_id::INTEGER NOT IN (SELECT id FROM users);

          -- Drop the old default value ('default_user')
          ALTER TABLE user_games ALTER COLUMN user_id DROP DEFAULT;

          -- Convert column type
          ALTER TABLE user_games ALTER COLUMN user_id TYPE INTEGER USING user_id::INTEGER;
          ALTER TABLE user_games ALTER COLUMN user_id SET NOT NULL;

          -- Add FK constraint
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_games_user'
          ) THEN
            ALTER TABLE user_games ADD CONSTRAINT fk_user_games_user
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;

          RAISE NOTICE '✅ Migrated user_games.user_id to INTEGER with FK';
        END IF;

        -- ── Migration 2: Drop redundant wishlist boolean column ──
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_games' AND column_name = 'wishlist'
        ) THEN
          -- Final safety: migrate any remaining wishlist=true rows
          UPDATE user_games SET status = 'wishlist'
            WHERE wishlist = true AND (status IS NULL OR status = '');
          ALTER TABLE user_games DROP COLUMN wishlist;
          RAISE NOTICE '✅ Dropped redundant wishlist column';
        END IF;

        -- ── Migration 3: TIMESTAMP → TIMESTAMPTZ ──
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users'
            AND column_name = 'created_at'
            AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE users
            ALTER COLUMN created_at TYPE TIMESTAMPTZ,
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ;
          RAISE NOTICE '✅ Migrated users TIMESTAMP columns to TIMESTAMPTZ';
        END IF;

        -- ── Migration 4: Add rating CHECK constraints if missing ──
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'games_rating_check'
        ) THEN
          IF NOT EXISTS (SELECT 1 FROM games WHERE rating < 0 OR rating > 5) THEN
            ALTER TABLE games ADD CONSTRAINT games_rating_check
              CHECK (rating >= 0 AND rating <= 5);
          END IF;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_games_user_rating_check'
        ) THEN
          IF NOT EXISTS (SELECT 1 FROM user_games WHERE user_rating < 0 OR user_rating > 5) THEN
            BEGIN
              ALTER TABLE user_games ADD CONSTRAINT user_games_user_rating_check
                CHECK (user_rating IS NULL OR (user_rating >= 0 AND user_rating <= 5));
            EXCEPTION WHEN duplicate_object THEN NULL;
            END;
          END IF;
        END IF;

        -- ── Migration 5: Ensure status CHECK includes 'wishlist' ──
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'user_games_status_check'
        ) THEN
          ALTER TABLE user_games DROP CONSTRAINT user_games_status_check;
          ALTER TABLE user_games ADD CONSTRAINT user_games_status_check
            CHECK (status IN ('playing', 'completed', 'hold', 'dropped', 'planning', 'wishlist'));
        END IF;

      END $$;
    `);

    // ==========================================
    // INDEXES
    // ==========================================

    // Drop the old B-tree title index (replaced by GIN trigram index)
    await client.query(`DROP INDEX IF EXISTS idx_games_title;`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_rawg_id ON games(rawg_id);
      CREATE INDEX IF NOT EXISTS idx_games_title_trgm ON games USING GIN (title gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
      CREATE INDEX IF NOT EXISTS idx_games_rating ON games(rating DESC);
      CREATE INDEX IF NOT EXISTS idx_games_released ON games(released DESC);
      CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games(metacritic DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_trending_rank ON trending_games(rank);
      CREATE INDEX IF NOT EXISTS idx_user_games_user ON user_games(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_games_status ON user_games(status);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
    `);

    // ==========================================
    // TRIGGERS - auto-update updated_at on users only
    // ==========================================
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated') THEN
          CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_timestamp();
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ All database tables created/verified successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Drop all tables (for development reset only)
 */
export async function resetDatabase() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`
      DROP TABLE IF EXISTS user_favorites CASCADE;
      DROP TABLE IF EXISTS user_games CASCADE;
      DROP TABLE IF EXISTS trending_games CASCADE;
      DROP TABLE IF EXISTS game_platforms CASCADE;
      DROP TABLE IF EXISTS game_genres CASCADE;
      DROP TABLE IF EXISTS games CASCADE;
      DROP TABLE IF EXISTS platforms CASCADE;
      DROP TABLE IF EXISTS genres CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_timestamp() CASCADE;
    `);
    await client.query('COMMIT');
    console.log('🗑️  All tables dropped successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error resetting database:', err);
    throw err;
  } finally {
    client.release();
  }
}
