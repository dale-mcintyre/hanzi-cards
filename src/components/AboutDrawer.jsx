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
            Learn Hanzi was designed and built by Dale McIntyre, a Mandarin learner who
            has tackled multiple languages and found reading to be his primary
            bottleneck. Most textbooks teach characters in a fixed HSK order, but that
            order has nothing to do with how often a character actually shows up in real
            Chinese. Learn Hanzi ranks its deck against the SUBTLEX-CH frequency corpus,
            drawn from real subtitle and media usage, so the characters you review first
            are the ones you will actually run into. HSK levels are still here as
            milestones you can filter by; however, frequency, not textbook order,
            decides what you see next.
          </p>
        </div>

        <div className="about-section">
          <h4>How It Works</h4>
          <p>
            Every card you grade feeds an SM-2 spaced repetition loop: cards you find
            easy get pushed further out, while cards you struggle with come back sooner,
            ensuring your review time goes toward what you are actually forgetting. The
            interface is designed for fast, frictionless flashcard flipping and
            character recall. Furthermore, the dual-ring tiles in Settings show two
            numbers at a glance per tier: the outer ring tracks how much you have seen,
            and the inner ring tracks how much you have mastered.
          </p>
        </div>

        <div className="about-section">
          <h4>Tech Stack &amp; Credits</h4>
          <p>
            Designed and built by Dale McIntyre. Built with React and Vite on the front
            end, character rendering powered by HanziWriter, and Supabase for accounts
            and cross-device sync.
          </p>
        </div>
      </div>
    </div>
  );
}
