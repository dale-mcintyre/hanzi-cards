export default function Countdown({ countdownNum }) {
  return (
    <div className="card countdown-card">
      <div className="countdown-overlay">
        <span className="countdown-number">{countdownNum > 0 ? countdownNum : 'GO!'}</span>
      </div>
    </div>
  );
}
