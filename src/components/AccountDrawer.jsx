import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { queueSize } from '../utils/syncQueue';

export default function AccountDrawer({ onClose }) {
  const { user, isSupabaseConfigured, signUp, signIn, signOut } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (mode === 'signup') {
      setSignupSuccess(true);
    } else {
      onClose();
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <h3>Account</h3>

        {!isSupabaseConfigured && (
          <p className="auth-error-text">
            Cross-device sync isn't set up yet. Your progress still saves normally on this device.
          </p>
        )}

        {isSupabaseConfigured && user && (
          <div style={{ marginTop: '12px' }}>
            <label className="box-section-label">Signed in as</label>
            <p style={{ margin: '4px 0 12px' }}>{user.email}</p>
            <p className="sync-status-line">
              {queueSize() > 0 ? `⏳ ${queueSize()} card${queueSize() === 1 ? '' : 's'} pending sync` : '✓ Synced'}
            </p>
            <button className="auth-submit-btn" onClick={() => { signOut(); onClose(); }}>
              Log Out
            </button>
          </div>
        )}

        {isSupabaseConfigured && !user && !signupSuccess && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <p style={{ fontSize: '12px', color: 'var(--ink-faint)', margin: '4px 0 12px' }}>
              Sign in to sync your progress across devices.
            </p>
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
            {error && <p className="auth-error-text">{error}</p>}
            <button className="auth-submit-btn" type="submit" disabled={submitting}>
              {submitting ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className="auth-toggle-link"
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </form>
        )}

        {isSupabaseConfigured && !user && signupSuccess && (
          <p style={{ marginTop: '12px' }}>
            Check your email to confirm your account, then sign in.
          </p>
        )}
      </div>
    </div>
  );
}
