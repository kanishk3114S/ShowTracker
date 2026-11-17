import React from 'react';

/** Standard surface: consistent radius, hairline border and background. */
export default function Card({ as: Tag = 'div', padded = true, interactive = false, className = '', children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={`rounded-xl border border-ink-edge bg-ink-surface shadow-card ${padded ? 'p-5' : ''} ${
        interactive ? 'transition duration-200 hover:-translate-y-0.5 hover:border-[#3b455e] hover:shadow-lift' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
