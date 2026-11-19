import { useSyncExternalStore } from 'react';

/**
 * One shared one-second clock for every live countdown on the page.
 * The interval only runs while at least one component is subscribed, and every tick reads
 * Date.now(), so the numbers stay correct even if the browser throttled a background tab.
 */
let current = Date.now();
const listeners = new Set();
let timer = null;

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => current;

/** Current time in ms, re-rendering the caller once per second. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** "2d 14h 22m 10s": leading zero units are dropped. Negative or zero -> "now". */
export function formatCountdown(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 'now';
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (d || h) parts.push(`${h}h`);
  if (d || h || m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
