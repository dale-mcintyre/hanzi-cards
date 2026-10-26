import useLongPress from '../hooks/useLongPress';
import { useStrokeOrder } from '../context/StrokeOrderContext';

/**
 * Wraps any character(s) so a long press opens the stroke-order sheet.
 * `as` picks the element (a span by default; pass 'button' to keep a
 * tappable chip a real button - its normal click still works, and a long
 * press doesn't also trigger it). `entry` is what the sheet shows:
 * { character, pinyin?, meaning? }, or just the character string.
 * `disabled` turns it off, e.g. on a quiz option before it's answered,
 * where watching the strokes would give the answer away.
 */
export default function LongPressHanzi({ entry, as: Tag = 'span', disabled = false, className = '', children, ...rest }) {
  const showStrokeOrder = useStrokeOrder();
  const handlers = useLongPress(() => showStrokeOrder(entry), { disabled });
  return (
    <Tag className={`long-press-hanzi ${className}`.trim()} {...rest} {...handlers}>
      {children}
    </Tag>
  );
}
