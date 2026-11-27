export const PLAY_STATUSES = [
  {
    id: 'playing',
    label: 'Playing',
    hint: 'Currently active',
    dotColor: 'var(--semantic-cyan, #06b6d4)',
  },
  {
    id: 'completed',
    label: 'Completed',
    hint: 'Finished title',
    dotColor: 'var(--semantic-emerald, #10b981)',
  },
  {
    id: 'hold',
    label: 'On hold',
    hint: 'Paused progress',
    dotColor: 'var(--semantic-amber, #f59e0b)',
  },
  {
    id: 'dropped',
    label: 'Dropped',
    hint: 'Discontinued',
    dotColor: 'var(--semantic-rose, #f43f5e)',
  },
  {
    id: 'wishlist',
    label: 'Wishlist',
    hint: 'Saved for later',
    dotColor: 'var(--accent-text, #60a5fa)',
  },
]

export default function GameStatusMenu({
  gameTitle,
  currentStatus = null,
  inWishlist = false,
  onSelectStatus,
  onRemoveFromList,
  onClose,
}) {
  const effectiveStatus = currentStatus || (inWishlist ? 'wishlist' : null)
  const isInList = !!effectiveStatus

  return (
    <div
      className="game-status-menu"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Set Game Status"
    >
      {/* Header */}
      <div className="status-menu-header">
        <span className="status-menu-title" title={gameTitle}>
          {gameTitle}
        </span>
        {onClose && (
          <button
            type="button"
            className="btn-ghost status-menu-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Status options list */}
      <div className="status-options-list">
        {PLAY_STATUSES.map((status) => {
          const isSelected = effectiveStatus === status.id

          return (
            <button
              key={status.id}
              type="button"
              className={`status-option-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectStatus && onSelectStatus(status.id)}
            >
              <span className="status-dot status-option-dot" style={{ background: status.dotColor }} />
              <div className="status-option-texts">
                <span className="status-option-label">{status.label}</span>
                <span className="status-option-hint">{status.hint}</span>
              </div>
              {isSelected && (
                <span className="status-option-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Remove from list action */}
      {isInList && onRemoveFromList && (
        <div className="status-menu-footer">
          <button
            type="button"
            className="btn-ghost status-remove-btn"
            onClick={onRemoveFromList}
          >
            Remove from list
          </button>
        </div>
      )}
    </div>
  )
}
