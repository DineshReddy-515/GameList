# GameList — Video Game Index & Library Tracker

A full-stack video game discovery and personal library tracker built with **React + Vite**, **Node.js + Express**, and **PostgreSQL** (Neon-ready), powered by data from the **RAWG Video Games Database API**.

---

## Features

- **Game Catalog & Search**: Browse and search games by title, genre, or platform using PostgreSQL `pg_trgm` trigram indexing.
- **Featured & Trending**: Hero banner and ranked trending games list.
- **Game Details Modal**: View cover artwork, descriptions, release dates, RAWG ratings, Metacritic scores, playtime, genres, and platforms (with lazy-loaded RAWG details cached in PostgreSQL).
- **Authentication**: Register, sign in, and manage user profiles with JWT (`jsonwebtoken`) and `bcryptjs` password hashing.
- **My List**: Track games with mutually exclusive statuses (`playing`, `completed`, `hold`, `dropped`, `planning`, `wishlist`), personal ratings, and notes.
- **Favorites**: Save favorite games independently of My List.
- **RAWG Batch Ingestion**: Resumable, rate-limit-aware sync scripts (`seed.js` and `syncAll.js`) using `INSERT ... ON CONFLICT DO UPDATE`.

---

## Tech Stack

- **Frontend**: React 19, Vite 8
- **Backend**: Node.js (ESM), Express 4, `pg`, `jsonwebtoken`, `bcryptjs`, `dotenv`
- **Database**: PostgreSQL (supports Neon / cloud `DATABASE_URL` with SSL or local PostgreSQL)

---

## Project Structure

```text
gameList/
├── Backend/
│   ├── db/
│   │   ├── pool.js          # PostgreSQL connection pool (DATABASE_URL or local config)
│   │   ├── schema.js        # Table definitions, migrations, indexes, and triggers
│   │   ├── seed.js          # Multi-era RAWG seeder & trending games updater
│   │   └── syncAll.js       # Full resumable RAWG pagination sync
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js          # /api/auth (register, login, me, profile)
│   │   ├── games.js         # /api/games (list, genres, platforms, trending, details)
│   │   └── user.js          # /api/user (profile, list, favorites)
│   ├── .env.example
│   ├── package.json
│   └── server.js            # Express app entry point
├── Frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/      # Navbar, Sidebar, HeroBanner, GameCard, GameModal, etc.
│   │   ├── api.js           # Backend API client & helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── .gitignore
```

---

## Database Schema

The PostgreSQL schema consists of 9 tables:

- `users` — User accounts, profile info, and timestamps (`created_at`, `updated_at`)
- `games` — Game metadata, ratings, Metacritic score, images, and descriptions
- `genres` & `game_genres` — Genre lookup and many-to-many game links
- `platforms` & `game_platforms` — Platform lookup and many-to-many game links
- `trending_games` — Ranked trending games
- `user_games` — Per-user game statuses, ratings, and notes
- `user_favorites` — Per-user favorited games

---

## Getting Started

### 1. Backend Setup

```bash
cd Backend
npm install
```

Create `Backend/.env` based on `Backend/.env.example`:

```env
PORT=5000
NODE_ENV=development

# Cloud PostgreSQL (Neon, Render, Supabase, etc.)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Or local PostgreSQL (used when DATABASE_URL is not set)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=gamelist
# DB_USER=postgres
# DB_PASSWORD=postgres

RAWG_API_KEY=your_rawg_api_key_here
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

Start the backend server (automatically initializes/verifies database tables on startup):

```bash
npm run dev    # Development (nodemon)
# or
npm start      # Production
```

The API runs on `http://localhost:5000` by default.

### 2. Frontend Setup

```bash
cd Frontend
npm install
```

Optionally create `Frontend/.env` (see `Frontend/.env.example`) if your backend is hosted elsewhere:

```env
# VITE_API_URL=https://your-backend-api.onrender.com
```

Start the Vite dev server or build for production:

```bash
npm run dev    # Development server
npm run build  # Production build into dist/
```

---

## Data Sync Scripts (Backend)

Run from inside `Backend/`:

- `npm run seed` — Seed games across eras + update `trending_games`
- `npm run seed:small` — Quick seed (2 pages per category)
- `npm run sync` — Run or resume full RAWG pagination sync
- `npm run sync:status` — Check current sync progress and game count
- `npm run sync:reset` — Restart full RAWG sync from page 1

---

## API Endpoints

### Health & Stats
- `GET /` — API info and endpoint index
- `GET /api/health` — Server and PostgreSQL health check
- `GET /api/stats` — Row counts for database tables

### Games
- `GET /api/games` — List/filter games (`search`, `genre`, `platform`, `sort`, `page`, `page_size`)
- `GET /api/games/genres` — List genres with game counts
- `GET /api/games/platforms` — List platforms with game counts
- `GET /api/games/trending` — List trending games by rank
- `GET /api/games/:id` — Get game details (fetches & caches missing RAWG descriptions)
- `POST /api/games` — Add a game manually

### Auth
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Sign in and receive a JWT
- `GET /api/auth/me` — Get current authenticated user
- `PUT /api/auth/profile` — Update user profile

### User Library & Favorites
- `GET /api/user/profile` — Get user profile and status counts
- `GET /api/user/list` — Get user's game list (optional `?status=`)
- `PUT /api/user/list/:gameId` — Add or update a game in My List
- `DELETE /api/user/list/:gameId` — Remove a game from My List
- `GET /api/user/favorites` — Get user's favorite games
- `POST /api/user/favorites/:gameId` — Add a game to Favorites
- `DELETE /api/user/favorites/:gameId` — Remove a game from Favorites
