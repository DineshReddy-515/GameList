export const STATUS_DEFINITIONS = [
  {
    id: 'all',
    label: 'All',
    description: 'All tracked titles in your collection',
  },
  {
    id: 'playing',
    label: 'Playing',
    description: 'Games currently in progress',
    dotColor: 'var(--semantic-cyan, #06b6d4)',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Finished games',
    dotColor: 'var(--semantic-emerald, #10b981)',
  },
  {
    id: 'hold',
    label: 'On hold',
    description: 'Paused games saved for later',
    dotColor: 'var(--semantic-amber, #f59e0b)',
  },
  {
    id: 'dropped',
    label: 'Dropped',
    description: 'Discontinued games',
    dotColor: 'var(--semantic-rose, #f43f5e)',
  },
  {
    id: 'wishlist',
    label: 'Wishlist',
    description: 'Games planned to play or purchase',
    dotColor: 'var(--accent-text, #60a5fa)',
  },
]

export default function MyListStatusBar({
  activeFilter = 'all',
  onSelectFilter,
  counts = {},
}) {
  const activeDef = STATUS_DEFINITIONS.find((d) => d.id === activeFilter) || STATUS_DEFINITIONS[0]

  return (
    <div className="status-filter-container">
      <div className="surface-card status-bar-wrapper" role="tablist" aria-label="Filter games by status">
        {STATUS_DEFINITIONS.map((def) => {
          const isActive = activeFilter === def.id
          const count = counts[def.id] || 0

          return (
            <button
              key={def.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`status-bar-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectFilter && onSelectFilter(def.id)}
            >
              {def.dotColor && (
                <span className="status-dot" style={{ background: def.dotColor }} />
              )}
              <span className="status-btn-label">{def.label}</span>
              <span className="status-btn-count tabular-nums">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {activeDef && activeDef.description && (
        <div className="status-bar-desc">
          <span>{activeDef.description}</span>
        </div>
      )}
    </div>
  )
}
