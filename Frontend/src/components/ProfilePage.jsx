import { useState, useMemo } from 'react'
import GameCard from './GameCard'
import MyListStatusBar from './MyListStatusBar'

export default function ProfilePage({
  user,
  onUpdateUser,
  onSignOut,
  onNavigateSignIn,
  games = [],
  gameStatuses = {},
  onUpdateGameStatus,
  onToggleWishlist,
  onRemoveFromList,
  savedGameIds = new Set(),
  onToggleSave,
  favoriteGameIds = new Set(),
  onToggleFavorite,
  onSelectGame,
  onBrowseGames,
}) {
  const [activeProfileTab, setActiveProfileTab] = useState('library')
  const [libraryFilter, setLibraryFilter] = useState('all')
  const [isEditingAvatar, setIsEditingAvatar] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: user?.name || 'Gamer',
    username: user?.username || 'gamer_tag',
    bio: user?.bio || 'Game library collector and enthusiast.',
    favoriteGenre: user?.favoriteGenre || 'Action',
  })
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false)

  // Status counts for status bar
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

  // Filtered games in library
  const filteredLibraryGames = useMemo(() => {
    return games.filter((game) => {
      const entry = gameStatuses[game.id]
      if (!entry) return false
      const effectiveStatus = entry.status || null
      if (!effectiveStatus) return false

      if (libraryFilter === 'all') {
        return true
      }
      return effectiveStatus === libraryFilter
    })
  }, [games, gameStatuses, libraryFilter])

  // Guest view
  if (!user) {
    return (
      <div className="profile-container animate-fade-in">
        <div className="surface-card guest-profile-card">
          <div className="guest-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="guest-title">Profile</h2>
          <p className="guest-subtitle">
            Sign in to manage your collection, record playthrough statuses, and sync your library across devices.
          </p>
          <div className="guest-action-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={onNavigateSignIn}
            >
              Sign in or register
            </button>
            {onBrowseGames && (
              <button
                type="button"
                className="btn-outline"
                onClick={onBrowseGames}
              >
                Browse catalog
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    onUpdateUser({
      ...user,
      ...editFormData,
    })
    setSaveSuccessNotice(true)
    setTimeout(() => {
      setSaveSuccessNotice(false)
    }, 2500)
  }

  return (
    <div className="profile-container animate-fade-in">
      {/* Profile Header Card */}
      <div className="surface-card profile-header-card">
        <div className="profile-identity-bar">
          <div className="profile-avatar-container">
            <div className="profile-avatar-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>

          <div className="profile-meta-info">
            <div className="profile-name-row">
              <h1 className="profile-display-name">{user.name || user.username || 'Gamer'}</h1>
            </div>
            <p className="profile-username">@{user.username || 'gamer'}</p>
            {user.bio && <p className="profile-bio-text">{user.bio}</p>}
          </div>

          <div className="profile-actions-bar">
            {onSignOut && (
              <button
                type="button"
                className="btn-outline profile-signout-btn"
                onClick={onSignOut}
                title="Sign out of account"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="profile-stats-grid">
        <div className="surface-card stat-card">
          <span className="stat-label">Currently playing</span>
          <span className="stat-value tabular-nums">{statusCounts.playing}</span>
        </div>

        <div className="surface-card stat-card">
          <span className="stat-label">Completed</span>
          <span className="stat-value tabular-nums">{statusCounts.completed}</span>
        </div>

        <div className="surface-card stat-card">
          <span className="stat-label">In wishlist</span>
          <span className="stat-value tabular-nums">{statusCounts.wishlist}</span>
        </div>

        <div className="surface-card stat-card">
          <span className="stat-label">Primary genre</span>
          <span className="stat-value genre-name">{user.favoriteGenre || 'Action'}</span>
        </div>
      </div>

      {/* Profile Section Tabs */}
      <div className="profile-tabs-header">
        <button
          type="button"
          className={`profile-tab-pill ${
            activeProfileTab === 'library' ? 'active' : ''
          }`}
          onClick={() => setActiveProfileTab('library')}
        >
          Library <span className="tab-count tabular-nums">({statusCounts.all})</span>
        </button>
        <button
          type="button"
          className={`profile-tab-pill ${
            activeProfileTab === 'settings' ? 'active' : ''
          }`}
          onClick={() => setActiveProfileTab('settings')}
        >
          Account settings
        </button>
      </div>

      {/* TAB CONTENT 1: LIBRARY */}
      {activeProfileTab === 'library' && (
        <div className="tab-pane-content">
          <MyListStatusBar
            activeFilter={libraryFilter}
            onSelectFilter={setLibraryFilter}
            counts={statusCounts}
          />

          {filteredLibraryGames.length === 0 ? (
            <div className="surface-card empty-state">
              <h3>No games in this section</h3>
              <p>Mark games in the catalog to add them to your library ledger.</p>
              {onBrowseGames && (
                <button
                  type="button"
                  className="btn-secondary empty-cta-btn"
                  onClick={onBrowseGames}
                >
                  Browse catalog
                </button>
              )}
            </div>
          ) : (
            <div className="games-grid">
              {filteredLibraryGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={onSelectGame}
                  gameStatusEntry={gameStatuses[game.id]}
                  onUpdateStatus={onUpdateGameStatus}
                  onToggleWishlist={onToggleWishlist}
                  onRemoveFromList={onRemoveFromList}
                  isSaved={() => true}
                  onToggleSave={onToggleSave}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onToggleFavorite={onToggleFavorite}
                  badgeType={game.trending ? 'trending' : game.recentlyReleased ? 'recent' : null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: SETTINGS */}
      {activeProfileTab === 'settings' && (
        <div className="tab-pane-content">
          <div className="surface-card profile-settings-card">
            <h3 className="settings-section-title">Account details</h3>

            {saveSuccessNotice && (
              <div className="settings-notice-success">
                Changes saved successfully
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="settings-form">
              <div className="form-group-row">
                <div className="form-field">
                  <label htmlFor="name-input">Display name</label>
                  <input
                    id="name-input"
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="username-input">Gamer tag</label>
                  <input
                    id="username-input"
                    type="text"
                    name="username"
                    value={editFormData.username}
                    onChange={handleEditChange}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="genre-select">Primary genre</label>
                <select
                  id="genre-select"
                  name="favoriteGenre"
                  value={editFormData.favoriteGenre}
                  onChange={handleEditChange}
                >
                  <option value="Action">Action</option>
                  <option value="RPG">RPG</option>
                  <option value="Souls-like">Souls-like</option>
                  <option value="Open World">Open World</option>
                  <option value="Shooter">Shooter</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Indie">Indie</option>
                  <option value="Adventure">Adventure</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="bio-input">Bio</label>
                <textarea
                  id="bio-input"
                  name="bio"
                  rows={3}
                  value={editFormData.bio}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn-primary save-profile-btn">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
