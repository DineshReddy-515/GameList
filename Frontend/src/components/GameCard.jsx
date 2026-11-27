import { useState, useRef, useEffect } from 'react'
import GameStatusMenu from './GameStatusMenu'

export default function GameCard({
  game,
  onSelect,
  gameStatusEntry = { status: null, wishlist: false },
  onUpdateStatus,
  onToggleWishlist,
  onRemoveFromList,
  badgeType = null,
  isSaved,
  onToggleSave,
  isFavorited = false,
  onToggleFavorite,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const cardRef = useRef(null)

  const effectiveStatus = gameStatusEntry?.status || null
  const isInList = !!effectiveStatus || (isSaved ? isSaved(game.id) : false)

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setIsMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const handlePlusClick = (e) => {
    e.stopPropagation()
    setIsMenuOpen((prev) => !prev)
  }

  const handleStatusSelect = (statusId) => {
    if (onUpdateStatus) {
      onUpdateStatus(game.id, statusId)
    } else if (onToggleSave) {
      onToggleSave(game)
    }
  }

  const handleRemove = () => {
    if (onRemoveFromList) {
      onRemoveFromList(game.id)
    } else if (onToggleSave) {
      onToggleSave(game)
    }
    setIsMenuOpen(false)
  }

  return (
    <div
      ref={cardRef}
      className={`game-card ${isMenuOpen ? 'menu-active' : ''}`}
      onClick={() => {
        if (!isMenuOpen && onSelect) {
          onSelect(game)
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isMenuOpen && onSelect) {
          onSelect(game)
        }
      }}
    >
      {/* Media Thumbnail */}
      <div className="card-media">
        <img
          src={game.image}
          alt={game.title}
          className="card-image"
          loading="lazy"
        />
        <div className="card-gradient-overlay" />

        {/* Top Badges */}
        <div className="card-top-badges">
          {badgeType === 'trending' && game.trendingRank && (
            <span className="badge-rank">#{game.trendingRank}</span>
          )}
          {badgeType === 'recent' && (
            <span className="badge-new">New</span>
          )}

          <span className="badge-rating">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="tabular-nums">{game.rating}</span>
          </span>
        </div>

        {/* Top-Right Action Buttons: Favorite + Status */}
        <div className="card-top-actions">
          {onToggleFavorite && (
            <button
              type="button"
              className={`icon-btn card-favorite-btn ${isFavorited ? 'is-favorited' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(game.id)
              }}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill={isFavorited ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}

          <button
            type="button"
            className={`icon-btn card-add-status-btn ${isInList ? 'has-status' : ''}`}
            onClick={handlePlusClick}
            aria-label="Set game status"
            title="Set status"
          >
            {isInList ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        </div>

        {/* Active Status Chip */}
        {effectiveStatus && (
          <div className="card-status-chip-container">
            <span className={`card-status-chip chip-${effectiveStatus}`}>
              <span className="status-chip-indicator" />
              <span className="status-chip-text">
                {effectiveStatus === 'hold' ? 'On hold' : effectiveStatus}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="card-info">
        <h3 className="card-title" title={game.title}>
          {game.title}
        </h3>

        <p className="card-brief">
          {game.briefDescription || game.description}
        </p>

        {/* Genres */}
        <div className="card-genres">
          {game.genres.slice(0, 3).map((genre) => (
            <span key={genre} className="tag-pill">
              {genre}
            </span>
          ))}
          {game.genres.length > 3 && (
            <span className="genre-tag-more">+{game.genres.length - 3}</span>
          )}
        </div>
      </div>

      {/* Popover Menu */}
      {isMenuOpen && (
        <GameStatusMenu
          gameTitle={game.title}
          currentStatus={effectiveStatus}
          onSelectStatus={handleStatusSelect}
          onRemoveFromList={handleRemove}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  )
}
