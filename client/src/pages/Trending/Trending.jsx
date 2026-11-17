import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';
import AppHeader from '../../components/layout/AppHeader';
import AppFooter from '../../components/layout/AppFooter';
import MediaCategoryTabs from '../../components/media/MediaCategoryTabs';
import MediaSkeleton from '../../components/media/MediaSkeleton';
import MediaGroupSection from '../../components/media/MediaGroupSection';
import ProviderErrorState from '../../components/media/ProviderErrorState';
import Pagination from '../../components/media/Pagination';
import { getTrendingMedia } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';

const WINDOWS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' }
];
const PREVIEW_COUNT = 12;

export default function Trending() {
  const [params, setParams] = useSearchParams();
  const type = ['ALL', 'ANIME', 'MOVIE', 'TV'].includes(params.get('type')) ? params.get('type') : 'ALL';
  const window_ = params.get('window') === 'day' ? 'day' : 'week';
  const page = type === 'ALL' ? 1 : Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const update = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
      },
      { replace: true }
    );

  const { data, error, loading, reload } = useApiResource(
    (signal) => getTrendingMedia({ type, window: window_, page }, signal),
    [type, window_, page]
  );
  const groups = data?.groups ?? [];
  const single = type !== 'ALL';

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6]">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Flame className="h-6 w-6 text-red-500" /> Trending
            </h1>
            <p className="mt-1 max-w-xl text-sm text-[#9CA3AF]">
              Movies and TV follow TMDB&rsquo;s daily or weekly trending lists. Anime uses AniList&rsquo;s own trending
              ranking, which has no day or week setting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MediaCategoryTabs value={type} onChange={(v) => update({ type: v === 'ALL' ? '' : v, page: '' })} />
            <div
              role="group"
              aria-label="Time window for movies and TV"
              className="inline-flex rounded-xl border border-[#2A3245] bg-[#151922] p-1"
            >
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  aria-pressed={window_ === w.value}
                  onClick={() => update({ window: w.value === 'week' ? '' : w.value, page: '' })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    window_ === w.value ? 'bg-[#2A3245] text-white' : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && !data ? (
          <MediaSkeleton />
        ) : error && !data ? (
          <ProviderErrorState error={error} onRetry={reload} />
        ) : (
          <div className={`space-y-10 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {groups.map((group) => (
              <MediaGroupSection
                key={group.mediaType}
                group={group}
                showHeading
                limit={single ? undefined : PREVIEW_COUNT}
                onRetry={reload}
              />
            ))}
            {single && groups[0] && !groups[0].error && (
              <Pagination
                page={page}
                totalPages={groups[0].pagination.totalPages}
                hasNextPage={groups[0].pagination.hasNextPage}
                disabled={loading}
                onChange={(p) => {
                  update({ page: p > 1 ? String(p) : '' });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
