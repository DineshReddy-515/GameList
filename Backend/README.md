# GameList Backend Server

A lightweight, high-performance REST API built exclusively with **Node.js** and **Express**.

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```
*(Only `express` is installed as requested)*

### 2. Run the Server
- **Production mode:**
  ```bash
  npm start
  ```
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

Default Port: `5000` (can be overridden with `PORT` environment variable).

---

## 📡 API Endpoints

### 🩺 Health & Meta
- `GET /` - Root service overview & endpoint index
- `GET /api/health` - Server health check & uptime

### 🎮 Games
- `GET /api/games` - Fetch all games
  - **Query Parameters:**
    - `?search=<text>` - Search by title, developer, or description
    - `?genre=<genre>` - Filter by genre (e.g., `Action RPG`)
    - `?platform=<platform>` - Filter by platform (e.g., `PC`, `PS5`)
    - `?trending=true|false` - Filter by trending state
    - `?sort=rating|trending|title` - Sort results
- `GET /api/games/genres` - Get list of all distinct genres
- `GET /api/games/trending` - Get list of trending games ordered by rank
- `GET /api/games/:id` - Get specific game details by ID
- `POST /api/games` - Add a new game to the collection

### 👤 User List & Profile
- `GET /api/user/profile` - Get user profile details
- `PUT /api/user/profile` - Update user profile information
- `GET /api/user/list` - Get user's game status list (Playing, Completed, Wishlist, etc.)
- `PUT /api/user/list/:gameId` - Set or update status / wishlist for a game
- `DELETE /api/user/list/:gameId` - Remove game from user list
