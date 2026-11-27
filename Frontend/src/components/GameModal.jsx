import { useEffect } from 'react'
import { PLAY_STATUSES } from './GameStatusMenu'
import { cleanDescriptionHtml } from '../api'

export default function GameModal({
  game,
  onClose,
  gameStatusEntry = { status: null, wishlist: false },
  onUpdateStatus,
  onToggleWishlist,
  onRemoveFromList,
  isSaved,
  onToggleSave,
  isFavorited = false,
  onToggleFavorite,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [onClose])

  if (!game) return null

  const effectiveStatus = gameStatusEntry?.status || null
  const isInList = !!effectiveStatus || (isSaved ? isSaved(game.id) : false)

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Banner with close button */}
        <div className="modal-media-header">
          <img
            src={game.banner || game.image}
            alt={game.title}
            className="modal-banner-img"
          />
          <div className="modal-media-gradient" />

          <button
            type="button"
            className="icon-btn modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="modal-header-meta">
            <div className="modal-badges">
              {game.trending && (
                <span className="badge-rank--rose">Rank #{game.trendingRank || 1}</span>
              )}
              {game.recentlyReleased && (
                <span className="modal-badge-recent">Recent</span>
              )}
              <span className="badge-rating">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="tabular-nums">{game.rating}</span>
              </span>
            </div>
            <h2 className="modal-title">{game.title}</h2>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Status Selection Toolbar */}
          <div className="modal-section modal-status-section">
            <div className="modal-status-header">
              <span className="modal-section-title">Status</span>
              {isInList && (
                <button
                  type="button"
                  className="btn-ghost modal-status-clear-btn"
                  onClick={() => onRemoveFromList && onRemoveFromList(game.id)}
                >
                  Remove from list
                </button>
              )}
            </div>

            <div className="modal-play-statuses">
              {PLAY_STATUSES.map((item) => {
                const isSelected = effectiveStatus === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`modal-status-chip-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => onUpdateStatus && onUpdateStatus(game.id, item.id)}
                  >
                    <span className="status-dot" style={{ background: item.dotColor }} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="modal-meta-grid">
            <div className="meta-box">
              <span className="meta-label">Release date</span>
              <span className="meta-value tabular-nums">{game.releaseDate || 'Unknown'}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">Rating</span>
              <span className="meta-value tabular-nums">{game.rating} / 5.0</span>
            </div>
            {game.metacritic && (
              <div className="meta-box">
                <span className="meta-label">Metacritic</span>
                <span className="meta-value tabular-nums">{game.metacritic}</span>
              </div>
            )}
            {game.playtime > 0 && (
              <div className="meta-box">
                <span className="meta-label">Average playtime</span>
                <span className="meta-value tabular-nums">{game.playtime} hrs</span>
              </div>
            )}
          </div>

          {game.description && (
            <div className="modal-section">
              <span className="modal-section-title">About</span>
              <p className="modal-description">{cleanDescriptionHtml(game.description)}</p>
            </div>
          )}

          {game.genres && game.genres.length > 0 && (
            <div className="modal-section">
              <span className="modal-section-title">Genres</span>
              <div className="modal-genres">
                {game.genres.map((g) => (
                  <span key={g} className="tag-pill">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {game.platforms && game.platforms.length > 0 && (
            <div className="modal-section">
              <span className="modal-section-title">Platforms</span>
              <div className="modal-platforms">
                {game.platforms.map((p) => (
                  <span key={p} className="tag-pill">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-footer-actions">
            <button
              type="button"
              className={`btn-primary modal-save-btn ${isInList ? 'saved' : ''}`}
              onClick={() => {
                if (onToggleSave) onToggleSave(game)
                else if (onToggleWishlist) onToggleWishlist(game.id)
              }}
            >
              {isInList ? 'Saved in list' : 'Add to list'}
            </button>

            {onToggleFavorite && (
              <button
                type="button"
                className={`btn-secondary modal-favorite-btn ${isFavorited ? 'favorited' : ''}`}
                onClick={() => onToggleFavorite(game.id)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={isFavorited ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>{isFavorited ? 'Favorited' : 'Favorite'}</span>
              </button>
            )}

            <button
              type="button"
              className="btn-outline"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
