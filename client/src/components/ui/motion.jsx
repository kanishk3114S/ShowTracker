import React, { useState, useEffect, useRef } from 'react';

/**
 * App-wide motion settings.
 * Honors the operating system's "reduce motion" preference via CSS media queries.
 */
export function MotionProvider({ children }) {
  return children;
}

/**
 * Fast, compositor-friendly fade-up entrance using native IntersectionObserver.
 * Uses hardware-accelerated CSS transitions instead of JS main-thread tick loops,
 * keeping Total Blocking Time (TBT) near zero and eliminating forced reflows.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  inView = false,
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const [visible, setVisible] = useState(
    () => !inView || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  );
  const ref = useRef(null);

  useEffect(() => {
    if (!inView || typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-40px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <Tag
      ref={ref}
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: '450ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${delay}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${y}px)`,
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Container for staggered cards. */
export function Stagger({ children, className = '', gap: _gap = 0.035, as: Tag = 'div', ...rest }) {
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  );
}

/** Fast CSS-animated card item. */
export function StaggerItem({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`animate-fade-up ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
