import { useState, useMemo } from 'react'
import HeroBanner from './HeroBanner'
import GameCard from './GameCard'
import MyListStatusBar from './MyListStatusBar'

export default function HomePage({
  games = [],
  trendingGames: externalTrending = [],
  genres = [],
  searchTerm = '',
  selectedGenre = 'All Genres',
  onSelectGenre,
  activeTab = 'home',
  onSelectTab,
  gameStatuses = {},
  onUpdateGameStatus,
  onToggleWishlist,
  onRemoveFromList,
  savedGameIds = new Set(),
  onToggleSave,
  favoriteGameIds = new Set(),
  onToggleFavorite,
  onSelectGame,
  isLoading = false,
  isAuthenticated = false,
}) {
  const [myListFilter, setMyListFilter] = useState('all')

  const isSaved = (gameId) => {
    const entry = gameStatuses[gameId]
    if (entry) {
      return !!entry.status
    }
    return savedGameIds.has(gameId)
  }

  // Filter games based on search term & genre
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const gTitle = game.title || ''
      const gGenres = Array.isArray(game.genres) ? game.genres : []
      const gPlatforms = Array.isArray(game.platforms) ? game.platforms : []

      const term = searchTerm.trim().toLowerCase()
      const wordStartRegex = term
        ? new RegExp(`(?:^|\\s|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
        : null

      const matchesSearch =
        !wordStartRegex ||
        wordStartRegex.test(gTitle) ||
        gGenres.some((g) => wordStartRegex.test(g)) ||
        gPlatforms.some((p) => wordStartRegex.test(p))

      const matchesGenre =
        selectedGenre === 'All Genres' ||
        gGenres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())

      return matchesSearch && matchesGenre
    })
  }, [games, searchTerm, selectedGenre])

  // Partition games
  const trendingGames = useMemo(() => {
    if (externalTrending && externalTrending.length > 0) {
      return externalTrending.filter((g) => {
        const gGenres = Array.isArray(g.genres) ? g.genres : []
        const matchesGenre =
          selectedGenre === 'All Genres' ||
          gGenres.some((x) => x.toLowerCase() === selectedGenre.toLowerCase())
        return matchesGenre
      })
    }
    return filteredGames.filter((g) => g.trending)
  }, [externalTrending, filteredGames, selectedGenre])

  const recentlyReleasedGames = useMemo(() => {
    return filteredGames.filter((g) => g.recentlyReleased)
  }, [filteredGames])

  const allDatabaseGames = useMemo(() => {
    return filteredGames
  }, [filteredGames])

  // Status counts for My List status bar
  const statusCounts = useMemo(() => {
    let all = 0
    let completed = 0
    let playing = 0
    let dropped = 0
    let hold = 0
    let wishlist = 0

    games.forEach((game) => {
      const entry = gameStatuses[game.id]
      if (!entry) return
      const effectiveStatus = entry.status || null
      if (!effectiveStatus) return

      all++
      if (effectiveStatus === 'completed') completed++
      else if (effectiveStatus === 'playing') playing++
      else if (effectiveStatus === 'dropped') dropped++
      else if (effectiveStatus === 'hold') hold++
      else if (effectiveStatus === 'wishlist') wishlist++
    })

    return { all, completed, playing, dropped, hold, wishlist }
  }, [games, gameStatuses])

  // Games in My List filtered by selected sub-status and optional search term
  const myListFilteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const wordStartRegex = term
      ? new RegExp(`(?:^|\\s|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      : null

    return games.filter((game) => {
      const entry = gameStatuses[game.id]
      if (!entry) return false
      const effectiveStatus = entry.status || null
      if (!effectiveStatus) return false

      if (myListFilter !== 'all' && effectiveStatus !== myListFilter) {
        return false
      }

      if (wordStartRegex) {
        const gTitle = game.title || ''
        const gGenres = Array.isArray(game.genres) ? game.genres : []
        const gPlatforms = Array.isArray(game.platforms) ? game.platforms : []

        const matchesSearch =
          wordStartRegex.test(gTitle) ||
          gGenres.some((g) => wordStartRegex.test(g)) ||
          gPlatforms.some((p) => wordStartRegex.test(p))

        if (!matchesSearch) return false
      }

      return true
    })
  }, [games, gameStatuses, myListFilter, searchTerm])

  // Games in Favorites filtered by optional search term (independent of My List)
  const favoritesFilteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const wordStartRegex = term
      ? new RegExp(`(?:^|\\s|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      : null

    return games.filter((game) => {
      if (!favoriteGameIds.has(game.id)) return false

      if (wordStartRegex) {
        const gTitle = game.title || ''
        const gGenres = Array.isArray(game.genres) ? game.genres : []
        const gPlatforms = Array.isArray(game.platforms) ? game.platforms : []

        const matchesSearch =
          wordStartRegex.test(gTitle) ||
          gGenres.some((g) => wordStartRegex.test(g)) ||
          gPlatforms.some((p) => wordStartRegex.test(p))

        if (!matchesSearch) return false
      }

      return true
    })
  }, [games, favoriteGameIds, searchTerm])

  const heroGames = useMemo(() => {
    if (externalTrending && externalTrending.length > 0) {
      return externalTrending.slice(0, 4)
    }
    return games.filter((g) => g.trending).slice(0, 4)
  }, [externalTrending, games])

  const isSearching = searchTerm.trim().length > 0

  const pillGenres =
    genres && genres.length > 0
      ? genres.slice(0, 15)
      : [
          'All Genres',
          'Action',
          'Adventure',
          'RPG',
          'Strategy',
          'Shooter',
          'Indie',
          'Simulation',
          'Casual',
          'Platformer',
        ]

  return (
    <div className="home-page-container">
      {/* Hero Spotlight */}
      {!isSearching && activeTab === 'home' && heroGames.length > 0 && (
        <HeroBanner
          games={heroGames}
          onSelectGame={onSelectGame}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
        />
      )}

      {/* Quick Category & Genre Bar */}
      {activeTab !== 'my-list' && activeTab !== 'favorites' && (
        <div className="surface-card discovery-filter-bar">
          <span className="filter-header-label">Genre</span>
          <div className="genre-scroll-pills">
            {pillGenres.map((genre) => (
              <button
                key={genre}
                type="button"
                className={`genre-pill ${
                  selectedGenre.toLowerCase() === genre.toLowerCase() ? 'active' : ''
                }`}
                onClick={() => onSelectGenre && onSelectGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="catalog-loading-row">
          <div className="catalog-loading-spinner" />
          <span>Loading catalog...</span>
        </div>
      )}

      {/* 1. Search Results View */}
      {isSearching && activeTab !== 'my-list' && activeTab !== 'favorites' && (
        <section className="section-block">
          <div className="section-header">
            <div>
              <h2 className="section-title">Search results</h2>
              <p className="section-subtitle">
                {filteredGames.length} titles matching &ldquo;{searchTerm}&rdquo;
              </p>
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="surface-card empty-state">
              <h3>No games found</h3>
              <p>No titles matched &ldquo;{searchTerm}&rdquo;. Try another term or reset genre filters.</p>
            </div>
          ) : (
            <div className="games-grid">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={onSelectGame}
                  gameStatusEntry={gameStatuses[game.id]}
                  onUpdateStatus={onUpdateGameStatus}
                  onToggleWishlist={onToggleWishlist}
                  onRemoveFromList={onRemoveFromList}
                  isSaved={isSaved}
                  onToggleSave={onToggleSave}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onToggleFavorite={onToggleFavorite}
                  badgeType={game.trending ? 'trending' : game.recentlyReleased ? 'recent' : null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. My List View */}
      {activeTab === 'my-list' && (
        <section className="section-block animate-fade-in">
          <div className="section-header">
            <div>
              <h2 className="section-title">My list</h2>
              <p className="section-subtitle">
                {isSearching
                  ? `${myListFilteredGames.length} titles matching “${searchTerm}”`
                  : `${statusCounts.all} saved games in your ledger`}
              </p>
            </div>
          </div>

          <MyListStatusBar
            activeFilter={myListFilter}
            onSelectFilter={setMyListFilter}
            counts={statusCounts}
          />

          {!isAuthenticated ? (
            <div className="surface-card empty-state">
              <h3>Sign in required</h3>
              <p>Sign in to add games to My list and track your playthrough status.</p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-secondary empty-cta-btn"
                  onClick={() => onSelectTab('signin')}
                >
                  Sign in
                </button>
              )}
            </div>
          ) : myListFilteredGames.length === 0 ? (
            <div className="surface-card empty-state">
              <h3>No games in this view</h3>
              <p>Add titles from the catalog to track your progress.</p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-secondary empty-cta-btn"
                  onClick={() => onSelectTab('home')}
                >
                  Browse catalog
                </button>
              )}
            </div>
          ) : (
            <div className="games-grid">
              {myListFilteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={onSelectGame}
                  gameStatusEntry={gameStatuses[game.id]}
                  onUpdateStatus={onUpdateGameStatus}
                  onToggleWishlist={onToggleWishlist}
                  onRemoveFromList={onRemoveFromList}
                  isSaved={isSaved}
                  onToggleSave={onToggleSave}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onToggleFavorite={onToggleFavorite}
                  badgeType={game.trending ? 'trending' : game.recentlyReleased ? 'recent' : null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2b. Favorites View */}
      {activeTab === 'favorites' && (
        <section className="section-block animate-fade-in">
          <div className="section-header">
            <div>
              <h2 className="section-title">Favorites</h2>
              <p className="section-subtitle">
                {isSearching
                  ? `${favoritesFilteredGames.length} titles matching “${searchTerm}”`
                  : `${favoriteGameIds.size} favorite games`}
              </p>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="surface-card empty-state">
              <h3>Sign in required</h3>
              <p>Sign in to save your favorite games and access them anywhere.</p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-secondary empty-cta-btn"
                  onClick={() => onSelectTab('signin')}
                >
                  Sign in
                </button>
              )}
            </div>
          ) : favoritesFilteredGames.length === 0 ? (
            <div className="surface-card empty-state">
              <h3>{isSearching ? 'No matching favorites' : 'No favorite games yet'}</h3>
              <p>
                {isSearching
                  ? `No favorite titles matched “${searchTerm}”.`
                  : 'Click the heart icon on any game to add it to your Favorites — whether it is in My list or not.'}
              </p>
              {!isSearching && onSelectTab && (
                <button
                  type="button"
                  className="btn-secondary empty-cta-btn"
                  onClick={() => onSelectTab('home')}
                >
                  Browse catalog
                </button>
              )}
            </div>
          ) : (
            <div className="games-grid">
              {favoritesFilteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={onSelectGame}
                  gameStatusEntry={gameStatuses[game.id]}
                  onUpdateStatus={onUpdateGameStatus}
                  onToggleWishlist={onToggleWishlist}
                  onRemoveFromList={onRemoveFromList}
                  isSaved={isSaved}
                  onToggleSave={onToggleSave}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onToggleFavorite={onToggleFavorite}
                  badgeType={game.trending ? 'trending' : game.recentlyReleased ? 'recent' : null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Catalog Sections */}
      {!isSearching && activeTab !== 'my-list' && activeTab !== 'favorites' && (
        <>
          {/* SECTION 1: TRENDING */}
          {(activeTab === 'home' || activeTab === 'trending') && (
            <section className="section-block" id="trending-section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Trending</h2>
                  <p className="section-subtitle">{trendingGames.length} popular titles</p>
                </div>

                {activeTab === 'home' && (
                  <button
                    type="button"
                    className="btn-ghost view-all-link"
                    onClick={() => onSelectTab && onSelectTab('trending')}
                  >
                    View all
                  </button>
                )}
              </div>

              {trendingGames.length === 0 ? (
                <div className="surface-card empty-state">
                  <p>No trending games found for {selectedGenre}.</p>
                </div>
              ) : (
                <div className="games-grid">
                  {(activeTab === 'home' ? trendingGames.slice(0, 8) : trendingGames).map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onSelect={onSelectGame}
                      gameStatusEntry={gameStatuses[game.id]}
                      onUpdateStatus={onUpdateGameStatus}
                      onToggleWishlist={onToggleWishlist}
                      onRemoveFromList={onRemoveFromList}
                      isSaved={isSaved}
                      onToggleSave={onToggleSave}
                      isFavorited={favoriteGameIds.has(game.id)}
                      onToggleFavorite={onToggleFavorite}
                      badgeType="trending"
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: RECENT RELEASES */}
          {(activeTab === 'home' || activeTab === 'recently-released') && (
            <section className="section-block" id="recent-section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Recent releases</h2>
                  <p className="section-subtitle">{recentlyReleasedGames.length} new titles</p>
                </div>

                {activeTab === 'home' && (
                  <button
                    type="button"
                    className="btn-ghost view-all-link"
                    onClick={() => onSelectTab && onSelectTab('recently-released')}
                  >
                    View all
                  </button>
                )}
              </div>

              {recentlyReleasedGames.length === 0 ? (
                <div className="surface-card empty-state">
                  <p>No recently released games found for {selectedGenre}.</p>
                </div>
              ) : (
                <div className="games-grid">
                  {(activeTab === 'home' ? recentlyReleasedGames.slice(0, 8) : recentlyReleasedGames).map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onSelect={onSelectGame}
                      gameStatusEntry={gameStatuses[game.id]}
                      onUpdateStatus={onUpdateGameStatus}
                      onToggleWishlist={onToggleWishlist}
                      onRemoveFromList={onRemoveFromList}
                      isSaved={isSaved}
                      onToggleSave={onToggleSave}
                      isFavorited={favoriteGameIds.has(game.id)}
                      onToggleFavorite={onToggleFavorite}
                      badgeType="recent"
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: CATALOG DISCOVERY */}
          {activeTab === 'home' && (
            <section className="section-block" id="discover-section">
              <div className="section-header">
                <div>
                  <h2 className="section-title">All games</h2>
                  <p className="section-subtitle">{allDatabaseGames.length} titles in catalog</p>
                </div>
              </div>

              <div className="games-grid">
                {allDatabaseGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onSelect={onSelectGame}
                    gameStatusEntry={gameStatuses[game.id]}
                    onUpdateStatus={onUpdateGameStatus}
                    onToggleWishlist={onToggleWishlist}
                    onRemoveFromList={onRemoveFromList}
                    isSaved={isSaved}
                    onToggleSave={onToggleSave}
                    badgeType={game.trending ? 'trending' : game.recentlyReleased ? 'recent' : null}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
