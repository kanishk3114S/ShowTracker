import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const MotionLink = motion.create(Link);
const HOVER = { y: -4, scale: 1.015 };
const TAP = { scale: 0.985 };
const SPRING = { type: 'spring', stiffness: 420, damping: 28 };

/**
 * Link wrapper for poster cards: springs up on hover (pointer devices only) and presses in on tap.
 * Children can still use `group-hover:` classes for the poster zoom and rim light.
 */
export default function PosterLink({ className = '', children, ...props }) {
  return (
    <MotionLink whileHover={HOVER} whileTap={TAP} transition={SPRING} className={`group block rounded-2xl ${className}`} {...props}>
      {children}
    </MotionLink>
  );
}
