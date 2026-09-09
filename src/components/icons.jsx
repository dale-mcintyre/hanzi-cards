// Minimal stroke-based icons, matching StudySession's existing
// flip-hint-btn SVG (hand-drawn, no icon library dependency) - used
// anywhere an emoji glyph (🔊/🚩/👤/⚙️) previously stood in for a
// function. A serious study tool reads as a precise instrument, not a
// consumer app, and emoji are one of the strongest "consumer app" tells.
const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function SpeakerIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" stroke="none" />
      <path d="M16 8a5 5 0 0 1 0 8" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

export function FlagIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}

export function PersonIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

export function GearIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
    </svg>
  );
}
