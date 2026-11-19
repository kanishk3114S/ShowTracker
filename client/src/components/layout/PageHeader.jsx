import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import GhostMark from '../cinema/GhostMark';

/** Page title block with optional breadcrumbs, description and right-aligned actions. */
export default function PageHeader({ title, description, breadcrumbs = [], icon: Icon, actions, watermark }) {
  return (
    <header className="relative mb-8">
      {watermark && <GhostMark text={watermark} position="right" className="!right-2 !top-2/3" />}
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                {crumb.to ? (
                  <Link to={crumb.to} className="transition hover:text-fg">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-fg-muted">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="relative flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {Icon && (
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-accent ring-1 ring-white/10">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            {title}
          </h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
