// A brief pause before a session starts (covers the queue-build/deck
// transition beat) - deliberately quiet rather than a workout-app-style
// "3...2...1...GO!": no exclamation, no bounce. Renders nothing for the
// one render where countdownNum reaches 0, immediately before appState
// flips to 'studying'.
export default function Countdown({ countdownNum }) {
  return (
    <div className="card countdown-card">
      <div className="countdown-overlay">
        {countdownNum > 0 && <span className="countdown-number">{countdownNum}</span>}
      </div>
    </div>
  );
}
