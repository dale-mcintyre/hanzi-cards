import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../utils/syncClient';

export default function BetaFeedbackDrawer({ onClose }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError('');
    const result = await submitFeedback({
      userId: user?.id ?? null,
      email: email.trim(),
      message: message.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError("Couldn't submit right now - please try again.");
      return;
    }
    setSubmitted(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <h3>Beta feedback</h3>
        <p style={{ fontSize: '13px', color: 'var(--ink-faint)', margin: '8px 0 0' }}>
          We're in active testing. Tell us about a bug or share an idea.
        </p>

        {submitted ? (
          <p style={{ marginTop: '12px' }}>Thanks, got it!</p>
        ) : (
          <div style={{ marginTop: '12px' }}>
            <textarea
              className="auth-input mistake-note-input"
              placeholder="What's on your mind?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />

            {!user && (
              <input
                className="auth-input"
                style={{ marginBottom: '12px' }}
                type="email"
                placeholder="Email (optional, if you'd like a reply)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}

            {error && <p className="auth-error-text">{error}</p>}

            <button
              className="auth-submit-btn"
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
            >
              {submitting ? 'Sending...' : 'Send feedback'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
