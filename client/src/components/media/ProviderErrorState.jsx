import React from 'react';
import { AlertTriangle, RefreshCw, Clock } from 'lucide-react';

/** Friendly provider/API failure panel. `error` is { code, message, retryAfterSeconds }. */
export default function ProviderErrorState({ error, onRetry, compact = false }) {
  const rateLimited = error?.code === 'PROVIDER_RATE_LIMITED';
  const Icon = rateLimited ? Clock : AlertTriangle;
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-2xl border border-red-900/50 bg-red-950/20 text-center ${compact ? 'px-4 py-6' : 'px-6 py-12'}`}
    >
      <Icon className="mb-2 h-7 w-7 text-red-400" />
      <h3 className="text-sm font-semibold text-white">
        {rateLimited ? 'Slow down a moment' : 'Could not load titles'}
      </h3>
      <p className="mt-1 max-w-md text-sm text-[#D1D5DB]">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#2A3245] bg-[#1C2230] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2A3245]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
