const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'trending',
    label: 'Trending',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    id: 'recently-released',
    label: 'Recent releases',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'my-list',
    label: 'My list',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

const DEFAULT_GENRES = [
  'All Genres',
  'Action',
  'RPG',
  'Shooter',
  'Adventure',
  'Strategy',
  'Indie',
  'Simulation',
  'Casual',
]

export default function Sidebar({
  isOpen = true,
  onClose,
  activeItem = 'home',
  onSelect,
  isCollapsed = false,
  _onToggleCollapse,
  selectedGenre = 'All Genres',
  onSelectGenre,
  genres = [],
  _currentUser = null,
}) {
  const handleItemClick = (id) => {
    if (onSelect) {
      onSelect(id)
    }
  }

  const genreList = genres && genres.length > 0 ? genres.slice(0, 10) : DEFAULT_GENRES

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? 'open' : 'closed'} ${isCollapsed ? 'collapsed' : ''}`}
        aria-label="Sidebar navigation"
      >
        <div className="sidebar-scroll-area">
          {/* Main Navigation */}
          <div className="sidebar-section">
            <span className="sidebar-section-heading">Navigation</span>
            <nav className="sidebar-nav">
              <ul className="sidebar-menu">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    activeItem === item.id ||
                    (activeItem === 'popular' && item.id === 'trending') ||
                    (activeItem === 'newly-release' && item.id === 'recently-released')

                  return (
                    <li key={item.id} className="sidebar-item">
                      <button
                        type="button"
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemClick(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="sidebar-icon-box">{item.icon}</span>
                        <span className="sidebar-label">{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>

          {/* Genres filter */}
          {!isCollapsed && onSelectGenre && (
            <div className="sidebar-section">
              <span className="sidebar-section-heading">Genres</span>
              <ul className="sidebar-genre-list">
                {genreList.map((genre) => {
                  const isSelected = selectedGenre.toLowerCase() === genre.toLowerCase()
                  return (
                    <li key={genre}>
                      <button
                        type="button"
                        className={`sidebar-genre-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => onSelectGenre(genre)}
                      >
                        <span className={`status-dot genre-dot ${isSelected ? 'active' : ''}`} />
                        <span className="genre-label">{genre}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
