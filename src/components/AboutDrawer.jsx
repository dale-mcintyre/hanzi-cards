export default function AboutDrawer({ onClose }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet about-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="about-drawer-header">
          <h3>About Learn Hanzi</h3>
          <button className="about-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="about-section">
          <h4>The Philosophy</h4>
          <p>
            Most textbooks teach characters in a fixed HSK order, but that order has
            nothing to do with how often a character actually shows up in real Chinese.
            Learn Hanzi ranks its deck against the SUBTLEX-CH frequency corpus, drawn
            from real subtitle and media usage, so the characters you review first are
            the ones you'll actually run into. HSK levels are still here as milestones
            you can filter by, but frequency, not textbook order, decides what you see
            next.
          </p>
        </div>

        <div className="about-section">
          <h4>How It Works</h4>
          <p>
            Every card you grade feeds an SM-2 spaced repetition loop: cards you find
            easy get pushed further out, cards you struggle with come back sooner, so
            your review time goes toward what you're actually forgetting. Writing mode
            has you trace each character stroke by stroke against real stroke-order
            data, not just recognize it. And the dual-ring tiles in Settings show two
            numbers at a glance per tier: the outer ring is how much you've seen, the
            inner ring is how much you've mastered.
          </p>
        </div>

        <div className="about-section">
          <h4>Tech Stack &amp; Credits</h4>
          <p>
            Built with React and Vite on the front end, character stroke rendering from
            HanziWriter, and Supabase for accounts and cross-device sync.
          </p>
        </div>

        <div className="about-footer">
          Learn Hanzi is an independently built tool for serious learners. Thanks for
          studying with it.
        </div>
      </div>
    </div>
  );
}
