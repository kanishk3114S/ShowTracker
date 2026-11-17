import React from 'react';

/** Standard page width + gutters. Pages choose where full-bleed sections start and end. */
export default function Container({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</Tag>;
}
