import { useState } from 'react'
import { loginUser, registerUser } from '../api'

export default function SignInPage({
  onSignIn,
  onCancel,
  initialMode = 'signin',
}) {
  const [mode, setMode] = useState(initialMode)
  const [formData, setFormData] = useState({
    emailOrUser: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    avatar: '🎮',
    rememberMe: true,
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (errorMessage) setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (mode === 'signin') {
      if (!formData.emailOrUser.trim()) {
        setErrorMessage('Enter your email or gamer tag.')
        return
      }
      if (!formData.password) {
        setErrorMessage('Enter your password.')
        return
      }

      setIsSubmitting(true)
      try {
        const response = await loginUser({
          emailOrUser: formData.emailOrUser.trim(),
          password: formData.password,
        })
        onSignIn(response.user, formData.rememberMe)
      } catch (err) {
        setErrorMessage(err.message || 'Login failed. Please check your credentials.')
      } finally {
        setIsSubmitting(false)
      }
    } else {
      if (!formData.username.trim() || formData.username.trim().length < 3) {
        setErrorMessage('Gamer tag must be at least 3 characters long.')
        return
      }
      if (!formData.email.trim() || !formData.email.includes('@')) {
        setErrorMessage('Enter a valid email address.')
        return
      }
      if (!formData.password || formData.password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.')
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMessage('Passwords do not match.')
        return
      }

      setIsSubmitting(true)
      try {
        const response = await registerUser({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          avatar: '🎮',
        })
        onSignIn(response.user, formData.rememberMe)
      } catch (err) {
        setErrorMessage(err.message || 'Registration failed.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="auth-page-container">
      <div className="surface-card auth-card">
        {/* Top Header */}
        <div className="auth-header">
          <h2 className="auth-title">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'signin'
              ? 'Access your personal library and tracked games'
              : 'Start cataloging and tracking your game collection'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setMode('signin')
              setErrorMessage('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup')
              setErrorMessage('')
            }}
          >
            Create account
          </button>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="auth-error-notice" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-field">
              <label htmlFor="reg-username">Gamer tag</label>
              <input
                id="reg-username"
                type="text"
                name="username"
                placeholder="tag_name"
                value={formData.username}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="username"
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="auth-identifier">
              {mode === 'signin' ? 'Email or gamer tag' : 'Email address'}
            </label>
            <input
              id="auth-identifier"
              type={mode === 'signin' ? 'text' : 'email'}
              name={mode === 'signin' ? 'emailOrUser' : 'email'}
              placeholder={mode === 'signin' ? 'you@example.com or your_tag' : 'you@example.com'}
              value={mode === 'signin' ? formData.emailOrUser : formData.email}
              onChange={handleChange}
              disabled={isSubmitting}
              autoComplete={mode === 'signin' ? 'username' : 'email'}
            />
          </div>

          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Authenticating...'
              : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
          </button>

          {onCancel && (
            <button
              type="button"
              className="btn-ghost auth-cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
