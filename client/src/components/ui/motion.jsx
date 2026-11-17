import React from 'react';
import { MotionConfig, motion } from 'motion/react';

/**
 * App-wide motion settings. `reducedMotion="user"` makes every Motion animation
 * honor the operating system's "reduce motion" preference (transform animations
 * are disabled; opacity fades remain gentle).
 */
export function MotionProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const ease = [0.22, 1, 0.36, 1];

/** Fade-up entrance. `inView` waits until the element scrolls into view (for long pages). */
export function Reveal({ children, delay = 0, y = 14, inView = false, className = '', as = 'div', ...rest }) {
  const Tag = motion[as] ?? motion.div;
  const motionProps = inView
    ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } }
    : { animate: { opacity: 1, y: 0 } };
  return (
    <Tag
      initial={{ opacity: 0, y }}
      {...motionProps}
      transition={{ duration: 0.5, delay, ease }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const containerVariants = (gap) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.02 } }
});
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } }
};

/** Container whose <StaggerItem> children fade up one after another. */
export function Stagger({ children, className = '', gap = 0.035, as = 'div', ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag variants={containerVariants(gap)} initial="hidden" animate="show" className={className} {...rest}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className = '', as = 'div', ...rest }) {
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag variants={itemVariants} className={className} {...rest}>
      {children}
    </Tag>
  );
}
