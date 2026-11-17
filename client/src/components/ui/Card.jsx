import React from 'react';

/**
 * Neutral frosted surface with a 1px top highlight.
 * `blur={false}` drops the backdrop blur for cards that appear many times on one screen.
 */
export default function Card({ as: Tag = 'div', padded = true, interactive = false, blur = true, className = '', children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={`relative overflow-hidden rounded-2xl ${blur ? 'glass' : 'glass-lite'} ${padded ? 'p-5' : ''} ${
        interactive ? 'transition duration-300 hover:-translate-y-1 hover:border-white/20' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
