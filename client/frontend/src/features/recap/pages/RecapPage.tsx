import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripRecap, RecapPhoto } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getRecap, recapPhotoUrl } from '../services/recapApi';
import { useTripRecap } from '../hooks/useTripRecap';
import { useAuthedBlobUrl } from '../../../shared/hooks/useAuthedBlobUrl';
import { useTrip } from '../../trips/pages/TripLayout';
import { Button } from '@/components/ui/button';

// F29: one gallery image. The source is streamed behind trip authorization, so it's loaded as an
// authenticated blob URL (an <img> can't send the auth header itself).
function GalleryImage({ photo }: { photo: RecapPhoto }) {
  const src = useAuthedBlobUrl(recapPhotoUrl(photo.url));
  const base = 'block aspect-[4/3] w-full rounded-[10px] border object-cover';
  if (!src) return <div className={`${base} bg-muted`} />;
  return <img className={base} src={src} alt="" loading="lazy" />;
}

export function RecapPage() {
  const { t } = useTranslation();
  const { tripId, changeSignal } = useTrip();
  const [recap, setRecap] = useState<TripRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gen = useTripRecap(tripId);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecap(await getRecap(tripId));
    } catch {
      setError(t('recap.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load, changeSignal]);

  async function handleGenerate() {
    await gen.generate();
    // Pick up the persisted copy (and its timestamp) after the stream completes.
    try {
      setRecap(await getRecap(tripId));
    } catch {
      /* keep the streamed text on screen */
    }
  }

  // Show the live stream while generating/just generated, otherwise the stored recap.
  const liveText = gen.status === 'streaming' || gen.status === 'done' ? gen.text : null;
  const text = liveText ?? recap?.content ?? null;
  const photos = recap?.photos ?? [];
  const busy = gen.status === 'streaming';

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={handleGenerate} disabled={busy}>
          {busy
            ? t('recap.generating')
            : recap?.content
              ? `↻ ${t('recap.regenerate')}`
              : `✨ ${t('recap.generate')}`}
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">{t('recap.loading')}</p>}
      {error && <p className="text-destructive">{error}</p>}
      {gen.error && <p className="text-destructive">{gen.error}</p>}

      {!loading && (
        <div>
          {photos.length > 0 && (
            <div className="mb-7 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {photos.map((p) => (
                <GalleryImage key={p.url} photo={p} />
              ))}
            </div>
          )}

          {text ? (
            <article className="text-foreground text-[1.08rem] leading-[1.75]">
              {text.split('\n\n').map((para, i) => (
                <p key={i} className="mb-[1.1em] whitespace-pre-wrap">{para}</p>
              ))}
              {busy && <span className="bg-primary inline-block h-[1.1em] w-2 animate-pulse align-text-bottom" aria-hidden />}
            </article>
          ) : (
            !busy && <p className="text-muted-foreground">{t('recap.empty')}</p>
          )}

          {!liveText && recap?.generatedAtUtc && (
            <p className="text-muted-foreground mt-6 text-sm opacity-80">
              {t('recap.generatedOn', { date: formatTripDate(recap.generatedAtUtc) })}
              {recap.model ? ` · ${recap.model}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
