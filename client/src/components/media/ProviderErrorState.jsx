import React from 'react';
import { AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import Button from '../ui/Button';

/** Friendly provider/API failure panel. `error` is { code, message, retryAfterSeconds }. */
export default function ProviderErrorState({ error, onRetry, compact = false }) {
  const rateLimited = error?.code === 'PROVIDER_RATE_LIMITED';
  const Icon = rateLimited ? Clock : AlertTriangle;
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-2xl border border-vermilion/30 bg-vermilion/5 text-center ${compact ? 'px-4 py-6' : 'px-6 py-14'}`}
    >
      <Icon className="mb-2 h-6 w-6 text-[#ff7b7b]" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-fg">{rateLimited ? 'Slow down a moment' : 'Could not load this'}</h3>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
