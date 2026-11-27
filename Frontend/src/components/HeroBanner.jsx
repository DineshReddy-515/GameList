import { useState, useEffect } from 'react'

export default function HeroBanner({ games, onSelectGame, isSaved, onToggleSave }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto rotate hero banner every 7 seconds
  useEffect(() => {
    if (!games || games.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % games.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [games])

  if (!games || games.length === 0) return null

  const currentGame = games[currentIndex]
  const saved = isSaved(currentGame.id)

  return (
    <div className="surface-card hero-banner">
      {/* Background with calm architectural vignette */}
      <div
        className="hero-backdrop"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 13, 17, 0.96) 0%, rgba(11, 13, 17, 0.8) 55%, rgba(11, 13, 17, 0.35) 100%), url(${currentGame.image})`,
        }}
      />

      <div className="hero-content">
        <div className="hero-meta">
          <span className="hero-badge-tag">Featured</span>
          {currentGame.trending && (
            <span className="badge-rank--rose">Rank #{currentGame.trendingRank || 1}</span>
          )}
          <span className="badge-rating hero-rating">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="tabular-nums">{currentGame.rating}</span>
          </span>
        </div>

        <h1 className="hero-title">{currentGame.title}</h1>

        <p className="hero-description">{currentGame.description}</p>

        <div className="hero-tags">
          {currentGame.genres.slice(0, 3).map((genre) => (
            <span key={genre} className="tag-pill">
              {genre}
            </span>
          ))}
          {currentGame.releaseDate && (
            <span className="hero-release-pill">{currentGame.releaseDate}</span>
          )}
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="hero-btn-primary"
            onClick={() => onSelectGame(currentGame)}
          >
            View details
          </button>

          <button
            type="button"
            className={`btn-secondary hero-btn-secondary ${saved ? 'saved' : ''}`}
            onClick={() => onToggleSave(currentGame)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>{saved ? 'In your list' : 'Add to list'}</span>
          </button>
        </div>
      </div>

      {/* Hero pagination dots */}
      <div className="hero-carousel-nav" aria-label="Hero carousel navigation">
        {games.map((g, idx) => (
          <button
            key={g.id}
            type="button"
            className={`hero-dot-btn ${idx === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Slide ${idx + 1}`}
          >
            <span className="dot-fill" />
          </button>
        ))}
      </div>
    </div>
  )
}
