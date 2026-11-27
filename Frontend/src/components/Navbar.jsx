import { useRef, useEffect } from 'react'

export default function Navbar({
  searchTerm = '',
  onSearchChange,
  onToggleSidebar,
  _myListCount = 0,
  _onOpenMyList,
  activeTab = 'home',
  onSelectTab,
  currentUser = null,
}) {
  const searchInputRef = useRef(null)

  const handleInputChange = (e) => {
    if (onSearchChange) {
      onSearchChange(e.target.value)
    }
  }

  const handleClear = () => {
    if (onSearchChange) {
      onSearchChange('')
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  // Keyboard shortcut listener: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <nav className="navbar" aria-label="Main Navigation">
      {/* Left side: Menu toggle + Wordmark */}
      <div className="navbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="icon-btn navbar-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            title="Toggle navigation"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <div
          className="navbar-brand"
          onClick={() => onSelectTab && onSelectTab('home')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelectTab && onSelectTab('home')}
        >
          <div className="brand-mark" aria-hidden="true">
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
              <rect x="2" y="6" width="20" height="12" rx="3" />
              <line x1="6" y1="12" x2="10" y2="12" />
              <line x1="8" y1="10" x2="8" y2="14" />
              <circle cx="15.5" cy="12" r=".75" fill="currentColor" />
              <circle cx="18" cy="10" r=".75" fill="currentColor" />
            </svg>
          </div>
          <span className="brand-wordmark">GameList</span>
        </div>
      </div>

      {/* Center: Search input */}
      <div className="navbar-search">
        <span className="search-icon" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          placeholder={activeTab === 'my-list' ? 'Search in My List' : 'Search games or platforms'}
          value={searchTerm}
          onChange={handleInputChange}
          aria-label={activeTab === 'my-list' ? 'Search in My List' : 'Search games'}
        />
        {!searchTerm && (
          <kbd className="search-keycap" title="Press / to search">/</kbd>
        )}
        {searchTerm && (
          <button
            type="button"
            className="btn-ghost clear-search-btn"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <svg
              width="13"
              height="13"
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
        )}
      </div>

      {/* Right side: Profile / Auth */}
      <div className="navbar-right">
        {currentUser ? (
          <button
            type="button"
            className={`navbar-profile-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => onSelectTab && onSelectTab('profile')}
            aria-label="View Profile"
            title={`Profile (${currentUser.name})`}
          >
            <div className="navbar-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="navbar-profile-label">{currentUser.name}</span>
          </button>
        ) : (
          <button
            type="button"
            className={`btn-secondary navbar-signin-btn ${activeTab === 'signin' ? 'active' : ''}`}
            onClick={() => onSelectTab && onSelectTab('signin')}
            aria-label="Sign in"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  )
}
