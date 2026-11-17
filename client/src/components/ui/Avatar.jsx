import React, { useState } from 'react';

const SIZES = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };

/** Profile picture with a graceful initial fallback (also used when the image URL fails to load). */
export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = failedSrc === src; // a new src gets a fresh attempt
  const initial = (name.trim()[0] || '?').toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-edge bg-ink-raised font-semibold text-fg-muted ${SIZES[size]} ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
