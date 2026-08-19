import { ColorPinyin } from '../utils/pinyinColor';

export default function CardInspectDrawer({ result, onClose }) {
  const { character, pinyin, meaning, isSuccess } = result;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="card-inspect-header">
          <span className="card-inspect-char">{character}</span>
          <span className={`card-inspect-outcome ${isSuccess ? 'card-inspect-outcome--know' : 'card-inspect-outcome--again'}`}>
            {isSuccess ? 'Nailed it' : 'Needs practice'}
          </span>
        </div>
        <h1 className="pinyin-title" style={{ marginTop: '10px' }}><ColorPinyin pinyin={pinyin} /></h1>
        <p className="meaning-primary">{meaning}</p>
      </div>
    </div>
  );
}
