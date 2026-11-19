import React from 'react';
import { Clapperboard, RefreshCw } from 'lucide-react';

/**
 * Catches render crashes below it and shows a calm card instead of a white screen.
 * `fallback` (optional) is shown instead of the error card; use `fallback={null}` for optional extras.
 * `resetKey` (for example the current path) clears the error when the user navigates away.
 * Details go to the console only in development.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, key: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // navigating somewhere else clears the error
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  // One click out of a corrupt session: forget everything stored in this browser and start over.
  handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* storage blocked: the reload below still helps */
    }
    window.location.replace('/');
  };

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback; // optional UI: fail quietly instead of showing the error card
    return (
      <div role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
          <Clapperboard className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-fg">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          The page hit an unexpected problem. Your library is safe. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-ink-base transition hover:bg-accent-hover"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload app
        </button>
        <button
          type="button"
          onClick={this.handleHardReset}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-medium text-fg-muted transition hover:bg-white/10 hover:text-fg"
        >
          Clear Local Cache &amp; Reset
        </button>
        <a href="/" className="mt-3 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Back to the start
        </a>
      </div>
    );
  }
}
