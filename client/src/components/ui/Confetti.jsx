import React, { useMemo } from 'react';
import { motion } from 'motion/react';

const COLORS = ['#F2B33D', '#F7C566', '#34D399', '#FAFAFA', '#D99A22'];

/**
 * A tiny, tasteful burst of gold sparks. Plays once on mount, then leaves nothing behind.
 * Purely decorative (aria-hidden, pointer-events-none); honors prefers-reduced-motion via MotionConfig.
 * Give it a new `key` to replay it.
 */
export default function Confetti({ count = 18, className = '' }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.25;
        const distance = 36 + ((i * 37) % 34); // deterministic spread, no Math.random in render
        return {
          x: Math.cos(angle) * distance * 1.6,
          y: Math.sin(angle) * distance - 14,
          rotate: ((i * 83) % 360) - 180,
          size: 4 + (i % 3) * 2,
          color: COLORS[i % COLORS.length],
          delay: (i % 5) * 0.015
        };
      }),
    [count]
  );
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 ${className}`}>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-[2px]"
          style={{ width: p.size, height: p.size * 0.55, background: p.color, left: 0, top: 0 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y + 26, opacity: 0, rotate: p.rotate, scale: 0.6 }}
          transition={{ duration: 0.9, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </span>
  );
}
