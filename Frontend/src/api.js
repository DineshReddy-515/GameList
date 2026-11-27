// ==========================================
// Frontend API Client & Normalizer
// Connects Frontend to PostgreSQL Express Backend
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:5000/api';

/**
 * Converts HTML description text from RAWG into clean plain text with preserved line breaks
 */
export function cleanDescriptionHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|h[1-6]|div|li|ul|ol)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  const decoded = withBreaks
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  return decoded.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normalizes a raw database game record into the format expected by UI components
 */
export function normalizeGame(g) {
  if (!g) return null;

  // Extract genre names
  const genresList = Array.isArray(g.genres)
    ? g.genres.map((x) => (typeof x === 'string' ? x : x.name)).filter(Boolean)
    : [];

  // Extract platform names
  const platformsList = Array.isArray(g.platforms)
    ? g.platforms.map((x) => (typeof x === 'string' ? x : x.name)).filter(Boolean)
    : [];

  // Format release date and determine if recently released
  let releaseDateStr = 'TBA';
  let isRecent = false;
  if (g.released) {
    const d = new Date(g.released);
    if (!isNaN(d.getTime())) {
      releaseDateStr = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      // Titles released from 2024 to present
      isRecent = d.getFullYear() >= 2024;
    }
  }

  // Fallback high quality gaming banner if image is missing
  const defaultPoster = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80';
  const defaultBanner = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=80';

  const title = g.title || 'Untitled Game';
  const desc = cleanDescriptionHtml(g.description || '');
  const brief = desc
    ? desc.replace(/\s+/g, ' ').slice(0, 150).trim() + '...'
    : `Experience high-octane gameplay and rich visuals in ${title}.`;

  const ratingVal = g.rating ? parseFloat(g.rating) : 4.5;
  const ratingStr = isNaN(ratingVal) || ratingVal === 0 ? '4.5' : ratingVal.toFixed(1);

  return {
    id: g.id,
    rawg_id: g.rawg_id,
    title,
    slug: g.slug || '',
    image: g.background_image || defaultPoster,
    banner: g.background_image_additional || g.background_image || defaultBanner,
    rating: ratingStr,
    metacritic: g.metacritic || null,
    releaseDate: releaseDateStr,
    genres: genresList.length > 0 ? genresList : ['Action', 'Adventure'],
    platforms: platformsList.length > 0 ? platformsList : ['PC', 'PlayStation 5'],
    trending: !!g.trending_rank || !!g.trending || false,
    trendingRank: g.trending_rank || (g.trending ? 1 : null),
    recentlyReleased: isRecent,
    description: desc || `Discover ${title}, an acclaimed title available on ${platformsList.join(', ') || 'multiple platforms'}.`,
    briefDescription: brief,
    developer: g.developer || 'Featured Studio',
    publisher: g.publisher || 'Global Publisher',
    playtime: g.playtime ? `${g.playtime} hrs avg` : '20 hrs avg',
    positiveRate: g.metacritic ? `${g.metacritic}% Metacritic` : '95% Positive',
  };
}

/**
 * Fetch games with optional filters
 */
export async function fetchGames({
  search = '',
  genre = '',
  platform = '',
  sort = 'rating',
  page = 1,
  pageSize = 50,
} = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (genre && genre !== 'All Genres') params.append('genre', genre);
  if (platform) params.append('platform', platform);
  if (sort) params.append('sort', sort);
  params.append('page', page);
  params.append('page_size', pageSize);

  const res = await fetch(`${API_BASE}/games?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch games: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    count: data.count,
    page: data.page,
    totalPages: data.total_pages,
    games: (data.games || []).map(normalizeGame),
  };
}

/**
 * Fetch top trending games
 */
export async function fetchTrendingGames() {
  const res = await fetch(`${API_BASE}/games/trending`);
  if (!res.ok) {
    throw new Error(`Failed to fetch trending games: ${res.statusText}`);
  }
  const data = await res.json();
  return (data.games || []).map(normalizeGame);
}

/**
 * Fetch single game details by DB id
 */
export async function fetchGameDetails(id) {
  const res = await fetch(`${API_BASE}/games/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch game #${id}: ${res.statusText}`);
  }
  const data = await res.json();
  return normalizeGame(data);
}

/**
 * Fetch all available genres with game counts
 */
export async function fetchGenres() {
  const res = await fetch(`${API_BASE}/games/genres`);
  if (!res.ok) {
    throw new Error('Failed to fetch genres');
  }
  return await res.json();
}

// ==========================================
// Authentication & Session Token Handling
// ==========================================
const TOKEN_KEY = 'my_gamelist_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage issues
  }
}

export function removeAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Register a new user with email and password
 */
export async function registerUser({ username, email, password, avatar, bio, favoriteGenre }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, avatar, bio, favoriteGenre }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register account');
  }

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

/**
 * Log in with email or username and password
 */
export async function loginUser({ emailOrUser, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUser, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to sign in');
  }

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

/**
 * Fetch current logged in user and their stats from token
 */
export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      removeAuthToken();
      return null;
    }
    throw new Error('Failed to fetch user session');
  }

  return await res.json();
}

/**
 * Update authenticated user profile
 */
export async function updateUserProfile(profileData) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }

  return data;
}

/**
 * Fetch user's saved game list from PostgreSQL
 */
export async function fetchUserList() {
  const res = await fetch(`${API_BASE}/user/list`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user list');
  }
  const data = await res.json();
  return data.games || [];
}

/**
 * Update a game's status in PostgreSQL user_games table
 */
export async function updateUserGame(gameId, { status, wishlist }) {
  const res = await fetch(`${API_BASE}/user/list/${gameId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, wishlist }),
  });
  if (!res.ok) {
    throw new Error('Failed to update game status in DB');
  }
  return await res.json();
}

/**
 * Remove a game from PostgreSQL user_games table
 */
export async function removeUserGame(gameId) {
  const res = await fetch(`${API_BASE}/user/list/${gameId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to remove game from user list');
  }
  return await res.json();
}

/**
 * Fetch user's favorite games from PostgreSQL
 */
export async function fetchUserFavorites() {
  const res = await fetch(`${API_BASE}/user/favorites`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch favorites');
  }
  const data = await res.json();
  return data.games || [];
}

/**
 * Add a game to user's favorites in PostgreSQL
 */
export async function addUserFavorite(gameId) {
  const res = await fetch(`${API_BASE}/user/favorites/${gameId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to add game to favorites');
  }
  return await res.json();
}

/**
 * Remove a game from user's favorites in PostgreSQL
 */
export async function removeUserFavorite(gameId) {
  const res = await fetch(`${API_BASE}/user/favorites/${gameId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to remove game from favorites');
  }
  return await res.json();
}
