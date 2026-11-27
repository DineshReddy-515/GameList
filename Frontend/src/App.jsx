import { useState, useEffect, useMemo, useRef } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import HomePage from './components/HomePage'
import GameModal from './components/GameModal'
import ProfilePage from './components/ProfilePage'
import SignInPage from './components/SignInPage'
import {
  fetchGames,
  fetchTrendingGames,
  fetchGameDetails,
  fetchGenres,
  fetchUserList,
  updateUserGame,
  removeUserGame,
  fetchUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  fetchCurrentUser,
  getAuthToken,
  removeAuthToken,
  normalizeGame,
} from './api'
import './App.css'
import './components/components.css'

export default function App() {
  const [games, setGames] = useState([])
  const [trendingGames, setTrendingGames] = useState([])
  const [availableGenres, setAvailableGenres] = useState(['All Genres'])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('home')
  const [selectedGenre, setSelectedGenre] = useState('All Genres')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [selectedGameForModal, setSelectedGameForModal] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Current logged in user (requires valid auth token)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (!getAuthToken()) return null
      const stored = localStorage.getItem('my_gamelist_user')
      if (stored) return JSON.parse(stored)
    } catch {
      // Ignore
    }
    return null
  })

  // Persist user to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('my_gamelist_user', JSON.stringify(currentUser))
      } else {
        localStorage.removeItem('my_gamelist_user')
      }
    } catch {
      // Ignore
    }
  }, [currentUser])

  // Game statuses (synced between PostgreSQL user_games table & local state)
  const [gameStatuses, setGameStatuses] = useState(() => {
    try {
      if (!getAuthToken()) return {}
      const stored = localStorage.getItem('my_gamelist_game_statuses')
      if (stored) return JSON.parse(stored)
    } catch {
      // Fallback
    }
    return {}
  })

  // Persist game statuses to localStorage for instant offline access
  useEffect(() => {
    try {
      if (currentUser && getAuthToken()) {
        localStorage.setItem('my_gamelist_game_statuses', JSON.stringify(gameStatuses))
      } else {
        localStorage.removeItem('my_gamelist_game_statuses')
      }
    } catch {
      // Ignore
    }
  }, [gameStatuses, currentUser])

  // Favorite game IDs (completely independent of My List / gameStatuses)
  const [favoriteGameIds, setFavoriteGameIds] = useState(() => {
    try {
      if (!getAuthToken()) return new Set()
      const stored = localStorage.getItem('my_gamelist_favorites')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return new Set(parsed.map(Number))
      }
    } catch {
      // Fallback
    }
    return new Set()
  })

  // Persist favorites to localStorage
  useEffect(() => {
    try {
      if (currentUser && getAuthToken()) {
        localStorage.setItem('my_gamelist_favorites', JSON.stringify(Array.from(favoriteGameIds)))
      } else {
        localStorage.removeItem('my_gamelist_favorites')
      }
    } catch {
      // Ignore
    }
  }, [favoriteGameIds, currentUser])

  // Show temporary toast
  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // 1. Initial Load: Fetch Trending, Main Games, Genres, and User List from PostgreSQL
  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      setIsLoading(true)
      setApiError(null)

      try {
        const [trendingData, mainGamesData, genresData, userListData, userFavoritesData, currentAuthData] = await Promise.allSettled([
          fetchTrendingGames(),
          fetchGames({ pageSize: 80, sort: 'rating' }),
          fetchGenres(),
          fetchUserList(),
          fetchUserFavorites(),
          fetchCurrentUser(),
        ])

        if (!isMounted) return

        // Restore authenticated user profile if token is valid, otherwise clear guest state
        if (currentAuthData.status === 'fulfilled' && currentAuthData.value?.user) {
          setCurrentUser(currentAuthData.value.user)
        } else {
          setCurrentUser(null)
          setGameStatuses({})
          setFavoriteGameIds(new Set())
        }

        let trendList = []
        if (trendingData.status === 'fulfilled') {
          trendList = trendingData.value
          setTrendingGames(trendList)
        }

        let mainList = []
        if (mainGamesData.status === 'fulfilled') {
          mainList = mainGamesData.value.games || []
        }

        // Merge trending with main list, ensuring trending games are included and deduplicated
        const combinedMap = new Map()
        trendList.forEach((g) => combinedMap.set(g.id, { ...g, trending: true }))
        mainList.forEach((g) => {
          if (!combinedMap.has(g.id)) {
            combinedMap.set(g.id, g)
          }
        })
        setGames(Array.from(combinedMap.values()))

        // Setup genres list
        if (genresData.status === 'fulfilled' && Array.isArray(genresData.value)) {
          const names = genresData.value.map((g) => g.name).filter(Boolean)
          setAvailableGenres(['All Genres', ...names])
        }

        // Sync user statuses from PostgreSQL and ensure all user games are in state
        if (userListData.status === 'fulfilled' && Array.isArray(userListData.value)) {
          const remoteStatuses = {}
          userListData.value.forEach((item) => {
            const gId = item.game_id || item.id
            if (gId) {
              const statusVal = item.status || null
              remoteStatuses[gId] = {
                status: statusVal,
              }
              if (!combinedMap.has(gId)) {
                const norm = normalizeGame({ ...item, id: gId })
                if (norm) combinedMap.set(gId, norm)
              }
            }
          })
          if (Object.keys(remoteStatuses).length > 0) {
            setGameStatuses((prev) => ({ ...prev, ...remoteStatuses }))
          }
          setGames(Array.from(combinedMap.values()))
        }

        // Sync user favorites from PostgreSQL and ensure all favorited games are in state
        if (userFavoritesData.status === 'fulfilled' && Array.isArray(userFavoritesData.value)) {
          const remoteFavIds = new Set()
          userFavoritesData.value.forEach((item) => {
            const gId = item.game_id || item.id
            if (gId) {
              remoteFavIds.add(Number(gId))
              if (!combinedMap.has(gId)) {
                const norm = normalizeGame({ ...item, id: gId })
                if (norm) combinedMap.set(gId, norm)
              }
            }
          })
          if (remoteFavIds.size > 0) {
            setFavoriteGameIds((prev) => new Set([...prev, ...remoteFavIds]))
          }
          setGames(Array.from(combinedMap.values()))
        }
      } catch (err) {
        console.error('Failed to load games from backend:', err)
        setApiError('Could not connect to PostgreSQL backend. Ensure the server is running on port 5000.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadInitialData()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Debounced Search against PostgreSQL database (catalog search only)
  const searchTimeoutRef = useRef(null)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const term = searchTerm.trim()
    if (!term) return

    // When on My List or Favorites, searching filters locally without fetching catalog games
    if (activeTab === 'my-list' || activeTab === 'favorites') return

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await fetchGames({ search: term, pageSize: 60 })
        if (result && result.games) {
          // Merge search results into current games map so they are available for rendering & modals
          setGames((prev) => {
            const map = new Map(prev.map((g) => [g.id, g]))
            result.games.forEach((g) => map.set(g.id, g))
            return Array.from(map.values())
          })
        }
      } catch (err) {
        console.warn('Search query error:', err.message)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchTerm, activeTab])

  // 3. Genre filtering from PostgreSQL
  useEffect(() => {
    if (selectedGenre === 'All Genres') return

    let cancelled = false
    async function fetchGenreGames() {
      try {
        const result = await fetchGames({ genre: selectedGenre, pageSize: 60 })
        if (!cancelled && result && result.games) {
          setGames((prev) => {
            const map = new Map(prev.map((g) => [g.id, g]))
            result.games.forEach((g) => map.set(g.id, g))
            return Array.from(map.values())
          })
        }
      } catch (err) {
        console.warn('Genre query error:', err.message)
      }
    }

    fetchGenreGames()
    return () => {
      cancelled = true
    }
  }, [selectedGenre])

  // Derived set of saved games for compatibility and navbar badge count
  const savedGameIds = useMemo(() => {
    const ids = new Set()
    Object.entries(gameStatuses).forEach(([id, data]) => {
      if (data && (data.status)) {
        ids.add(Number(id))
      }
    })
    return ids
  }, [gameStatuses])

  // Require authenticated user before modifying My List or Favorites
  const requireAuth = () => {
    if (!currentUser || !getAuthToken()) {
      setSelectedGameForModal(null)
      setActiveTab('signin')
      showToast('Please sign in to add games to My list or Favorites.')
      return false
    }
    return true
  }

  // Update game primary status (mutually exclusive: completed / playing / dropped / hold / wishlist)
  const handleUpdateGameStatus = async (gameId, newStatus) => {
    if (!requireAuth()) return
    const numericId = Number(gameId)
    const game = games.find((g) => g.id === numericId)
    const title = game?.title || 'Game'

    const current = gameStatuses[numericId] || { status: null }
    const currentEffective = current.status || null
    const nextStatus = currentEffective === newStatus ? null : newStatus

    const updated = {
      status: nextStatus,
    }

    // Optimistic UI update
    setGameStatuses((prev) => {
      const next = { ...prev }
      if (!updated.status) {
        delete next[numericId]
      } else {
        next[numericId] = updated
      }
      return next
    })

    const labels = {
      completed: 'Completed 🏆',
      playing: 'Playing 🎮',
      dropped: 'Dropped 🛑',
      hold: 'On Hold ⏸️',
      wishlist: 'Wishlist 💖',
    }

    if (nextStatus) {
      showToast(`Marked "${title}" as ${labels[nextStatus] || nextStatus}`)
    } else {
      showToast(`Removed "${title}" from My List`)
    }

    // Sync to PostgreSQL backend
    try {
      if (!updated.status) {
        await removeUserGame(numericId)
      } else {
        await updateUserGame(numericId, updated)
      }
    } catch (err) {
      console.warn('Could not sync status to backend:', err.message)
    }
  }

  // Toggle Wishlist status: now simply updates status to 'wishlist' or toggles it off
  const handleToggleWishlist = async (gameId) => {
    await handleUpdateGameStatus(gameId, 'wishlist')
  }

  // Remove game entirely from My List
  const handleRemoveFromList = async (gameId) => {
    if (!requireAuth()) return
    const numericId = Number(gameId)
    const game = games.find((g) => g.id === numericId)
    const title = game?.title || 'Game'

    setGameStatuses((prev) => {
      const next = { ...prev }
      delete next[numericId]
      return next
    })
    showToast(`Removed "${title}" from My List`)

    try {
      await removeUserGame(numericId)
    } catch (err) {
      console.warn('Could not remove game from backend:', err.message)
    }
  }

  // Toggle bookmark / quick save (defaults to wishlist)
  const handleToggleSave = async (game) => {
    if (!requireAuth()) return
    const current = gameStatuses[game.id]
    const currentEffective = current ? (current.status || null) : null
    if (currentEffective) {
      await handleRemoveFromList(game.id)
    } else {
      await handleUpdateGameStatus(game.id, 'wishlist')
    }
  }

  // Toggle Favorite status (completely independent of My List)
  const handleToggleFavorite = async (gameId) => {
    if (!requireAuth()) return
    const numericId = Number(gameId)
    const game = games.find((g) => g.id === numericId)
    const title = game?.title || 'Game'
    const wasFavorited = favoriteGameIds.has(numericId)

    setFavoriteGameIds((prev) => {
      const next = new Set(prev)
      if (wasFavorited) {
        next.delete(numericId)
      } else {
        next.add(numericId)
      }
      return next
    })

    if (wasFavorited) {
      showToast(`Removed "${title}" from Favorites`)
    } else {
      showToast(`Added "${title}" to Favorites ❤️`)
    }

    try {
      if (wasFavorited) {
        await removeUserFavorite(numericId)
      } else {
        await addUserFavorite(numericId)
      }
    } catch (err) {
      console.warn('Could not sync favorite to backend:', err.message)
    }
  }

  // Open Game Modal with lazy full-detail fetch from PostgreSQL & RAWG
  const handleSelectGame = async (game) => {
    setSelectedGameForModal(game)
    try {
      const detailed = await fetchGameDetails(game.id)
      if (detailed) {
        setSelectedGameForModal((prev) => (prev && prev.id === game.id ? { ...prev, ...detailed } : prev))
      }
    } catch {
      // If detailed fetch fails, basic game data is already shown
    }
  }

  // Select Tab
  const handleSelectTab = (tabId) => {
    let target = tabId
    if (tabId === 'popular') target = 'trending'
    if (tabId === 'newly-release') target = 'recently-released'

    setActiveTab(target)
    setIsSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Select Genre
  const handleSelectGenre = (genre) => {
    setSelectedGenre(genre)
    setIsSidebarOpen(false)
    if (activeTab === 'profile' || activeTab === 'signin') {
      setActiveTab('home')
    }
  }

  // Handle Search Input
  const handleSearchChange = (term) => {
    setSearchTerm(term)
    if (term.trim().length > 0 && (activeTab === 'profile' || activeTab === 'signin')) {
      setActiveTab('home')
    }
  }

  // Toggle Sidebar
  const handleToggleSidebar = () => {
    if (window.innerWidth <= 820) {
      setIsSidebarOpen((prev) => !prev)
    } else {
      setIsSidebarCollapsed((prev) => !prev)
    }
  }

  // User Auth handlers
  const handleSignIn = async (user) => {
    setCurrentUser(user)
    showToast(`Welcome back, ${user.name || user.username}! 🎮`)
    setActiveTab('profile')

    // Refetch the personal user list & favorites for the authenticated user
    try {
      const [userList, userFavorites] = await Promise.all([
        fetchUserList(),
        fetchUserFavorites(),
      ])
      const remoteStatuses = {}
      const remoteFavIds = new Set()

      setGames((prev) => {
        const map = new Map(prev.map((g) => [g.id, g]))
        if (Array.isArray(userList)) {
          userList.forEach((item) => {
            const gId = item.game_id || item.id
            if (gId && !map.has(gId)) {
              const norm = normalizeGame({ ...item, id: gId })
              if (norm) map.set(gId, norm)
            }
          })
        }
        if (Array.isArray(userFavorites)) {
          userFavorites.forEach((item) => {
            const gId = item.game_id || item.id
            if (gId && !map.has(gId)) {
              const norm = normalizeGame({ ...item, id: gId })
              if (norm) map.set(gId, norm)
            }
          })
        }
        return Array.from(map.values())
      })

      if (Array.isArray(userList)) {
        userList.forEach((item) => {
          const gId = item.game_id || item.id
          if (gId) {
            const statusVal = item.status || null
            remoteStatuses[gId] = {
              status: statusVal,
            }
          }
        })
      }
      if (Array.isArray(userFavorites)) {
        userFavorites.forEach((item) => {
          const gId = item.game_id || item.id
          if (gId) remoteFavIds.add(Number(gId))
        })
      }

      setGameStatuses(remoteStatuses)
      setFavoriteGameIds(remoteFavIds)
    } catch (err) {
      console.warn('Could not sync user list/favorites:', err.message)
    }
  }

  const handleSignOut = () => {
    removeAuthToken()
    setCurrentUser(null)
    setGameStatuses({})
    setFavoriteGameIds(new Set())
    showToast('Signed out of MyGameList.')
    setActiveTab('home')
  }

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser)
    showToast('Profile updated successfully! ✨')
  }

  return (
    <div className="app-root">
      {/* Top Navbar */}
      <Navbar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onToggleSidebar={handleToggleSidebar}
        myListCount={savedGameIds.size}
        onOpenMyList={() => handleSelectTab('my-list')}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
      />

      <div className="app-body">
        {/* Left Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeItem={activeTab}
          onSelect={handleSelectTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          selectedGenre={selectedGenre}
          onSelectGenre={handleSelectGenre}
          genres={availableGenres}
          currentUser={currentUser}
        />

        {/* Main Content Area */}
        <main className="app-main" id="main-content">
          {apiError && (
            <div
              style={{
                margin: '16px 24px',
                padding: '12px 18px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span>⚠️</span>
              <span>{apiError}</span>
            </div>
          )}

          {activeTab === 'profile' ? (
            <ProfilePage
              user={currentUser}
              onUpdateUser={handleUpdateUser}
              onSignOut={handleSignOut}
              onNavigateSignIn={() => setActiveTab('signin')}
              games={games}
              gameStatuses={gameStatuses}
              onUpdateGameStatus={handleUpdateGameStatus}
              onToggleWishlist={handleToggleWishlist}
              onRemoveFromList={handleRemoveFromList}
              savedGameIds={savedGameIds}
              onToggleSave={handleToggleSave}
              favoriteGameIds={favoriteGameIds}
              onToggleFavorite={handleToggleFavorite}
              onSelectGame={handleSelectGame}
              onBrowseGames={() => setActiveTab('home')}
            />
          ) : activeTab === 'signin' ? (
            <SignInPage
              onSignIn={handleSignIn}
              onCancel={() => setActiveTab('home')}
            />
          ) : (
            <HomePage
              games={games}
              trendingGames={trendingGames}
              genres={availableGenres}
              searchTerm={searchTerm}
              selectedGenre={selectedGenre}
              onSelectGenre={handleSelectGenre}
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              gameStatuses={gameStatuses}
              onUpdateGameStatus={handleUpdateGameStatus}
              onToggleWishlist={handleToggleWishlist}
              onRemoveFromList={handleRemoveFromList}
              savedGameIds={savedGameIds}
              onToggleSave={handleToggleSave}
              favoriteGameIds={favoriteGameIds}
              onToggleFavorite={handleToggleFavorite}
              onSelectGame={handleSelectGame}
              isLoading={isLoading}
              isAuthenticated={!!currentUser}
            />
          )}
        </main>
      </div>

      {/* Game Details Modal */}
      {selectedGameForModal && (
        <GameModal
          game={selectedGameForModal}
          onClose={() => setSelectedGameForModal(null)}
          gameStatusEntry={gameStatuses[selectedGameForModal.id]}
          onUpdateStatus={handleUpdateGameStatus}
          onToggleWishlist={handleToggleWishlist}
          onRemoveFromList={handleRemoveFromList}
          isSaved={(id) => savedGameIds.has(id)}
          onToggleSave={handleToggleSave}
          isFavorited={favoriteGameIds.has(selectedGameForModal.id)}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="app-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
