import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

/** Image with a shimmering placeholder until it loads, and a graceful fallback if it fails. */
export default function PosterImage({ src, alt, className = '', imgClassName = '', fallbackLabel = 'No artwork', priority = false }) {
  const [state, setState] = useState(src ? 'loading' : 'error');
  return (
    <div className={`${/\babsolute\b/.test(className) ? '' : 'relative'} overflow-hidden bg-ink-surface ${className}`}>
      {state !== 'error' && src && (
        <>
          {state === 'loading' && <div className="skeleton absolute inset-0" aria-hidden="true" />}
          <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setState('loaded')}
            onError={() => setState('error')}
            className={`h-full w-full object-cover transition-opacity duration-500 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
          />
        </>
      )}
      {state === 'error' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-fg-subtle">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
          <span className="text-xs">{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
