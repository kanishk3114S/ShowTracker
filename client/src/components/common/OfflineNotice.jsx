import React, { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
const getOnline = () => navigator.onLine;

/** A discreet pill at the top of the screen while the browser has no connection. */
export default function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  if (online) return null;

  return (
    <div
      role="status"
      className="animate-fade-in pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-4"
    >
      <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-fg shadow-lift">
        <WifiOff className="h-4 w-4 text-amber-400" aria-hidden="true" />
        You are offline. Showing cached library data.
      </span>
    </div>
  );
}
