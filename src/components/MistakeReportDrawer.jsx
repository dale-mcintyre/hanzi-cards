import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportMistake } from '../utils/syncClient';

const REASONS = [
  { value: 'wrong_pinyin', label: 'Wrong pinyin' },
  { value: 'wrong_meaning', label: 'Wrong meaning' },
  { value: 'wrong_reading', label: 'Wrong reading' },
  { value: 'other', label: 'Other' },
];

export default function MistakeReportDrawer({ card, onClose, onRequestSignIn }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('wrong_meaning');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const result = await reportMistake(user.id, {
      cardId: card.id,
      character: card.character,
      reason,
      note: note.trim(),
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
        <h3>Report an issue with {card.character}</h3>

        {!user && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--ink-faint)', marginBottom: '12px' }}>
              Sign in to report an issue with this card.
            </p>
            <button className="auth-submit-btn" onClick={onRequestSignIn}>
              Sign in
            </button>
          </div>
        )}

        {user && submitted && (
          <p style={{ marginTop: '12px' }}>Reported — thanks!</p>
        )}

        {user && !submitted && (
          <div style={{ marginTop: '12px' }}>
            <label className="box-section-label">What's wrong?</label>
            <div className="settings-level-grid" style={{ marginTop: '8px' }}>
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  className={`level-toggle-btn ${reason === r.value ? 'active' : ''}`}
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              className="auth-input mistake-note-input"
              placeholder="Anything else? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />

            {error && <p className="auth-error-text">{error}</p>}

            <button className="auth-submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
