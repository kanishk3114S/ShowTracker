import React from 'react';
import MediaCard from './MediaCard';
import { Stagger, StaggerItem, POSTER_GRID } from '../ui';

/** Responsive poster grid whose cards fade up in sequence. Remount (via `key`) to replay. */
export default function PosterGrid({ items }) {
  return (
    <Stagger className={POSTER_GRID} gap={0.03}>
      {items.map((media) => (
        <StaggerItem key={`${media.provider}:${media.mediaType}:${media.externalId}`}>
          <MediaCard media={media} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
