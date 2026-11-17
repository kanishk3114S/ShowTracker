import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/**
 * Number that counts up from 0 (or from its previous value) to `value`.
 * Non-numeric values (like "—") are shown as is; reduced-motion users see the number immediately.
 */
export default function CountUp({ value, decimals = 0, duration = 0.9, className = '' }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const reduce = useReducedMotion();
  const from = useRef(0);
  const [shown, setShown] = useState(numeric && !reduce ? 0 : value);

  useEffect(() => {
    if (!numeric || reduce) {
      setShown(value);
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v)
    });
    from.current = value;
    return () => controls.stop();
  }, [value, numeric, reduce, duration]);

  const text = typeof shown === 'number' ? shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : shown;
  return <span className={className}>{text}</span>;
}
