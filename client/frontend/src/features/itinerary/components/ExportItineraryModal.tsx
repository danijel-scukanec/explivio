import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadItinerary, calendarFeedUrl, calendarWebcalUrl } from '../services/calendarApi';
import { createShareLink } from '../../gallery/services/galleryApi';
import '../../gallery/components/ShareTripModal.css';
import './ExportItineraryModal.css';

// F27: export / calendar-sync controls for a trip. Download the itinerary as .ics or PDF, or get a
// live subscription link that Google/Outlook/Apple Calendar poll. The feed reuses the F26 share token
// (minted here on demand if the trip doesn't have one yet) — revoking the share link, in the Share
// dialog, also stops the feed.
export function ExportItineraryModal({ tripId, tripName, shareToken, onClose, onChanged }: {
  tripId: string;
  tripName: string;
  shareToken: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(shareToken);
  const [busy, setBusy] = useState<null | 'ics' | 'pdf' | 'link'>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function download(format: 'ics' | 'pdf') {
    setBusy(format);
    setError(false);
    try {
      await downloadItinerary(tripId, format, tripName);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function makeLink() {
    setBusy('link');
    try {
      const link = await createShareLink(tripId);
      setToken(link.shareToken);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(calendarFeedUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the link is shown for manual copy */ }
  }

  return (
    <div className="share-modal__overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal__head">
          <h2>{t('export.title')}</h2>
          <button className="share-modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <div className="share-modal__section">
          <strong>{t('export.downloadTitle')}</strong>
          <span className="share-modal__hint">{t('export.downloadHint')}</span>
          <div className="export-modal__buttons">
            <button className="btn btn--ghost" onClick={() => download('ics')} disabled={busy !== null}>
              📅 {busy === 'ics' ? t('export.preparing') : t('export.downloadIcs')}
            </button>
            <button className="btn btn--ghost" onClick={() => download('pdf')} disabled={busy !== null}>
              📄 {busy === 'pdf' ? t('export.preparing') : t('export.downloadPdf')}
            </button>
          </div>
          {error && <span className="share-modal__hint" style={{ color: 'var(--danger, #c0392b)' }}>{t('export.failed')}</span>}
        </div>

        <div className="share-modal__section">
          <strong>{t('export.syncTitle')}</strong>
          <span className="share-modal__hint">{t('export.syncHint')}</span>
          {token ? (
            <>
              <div className="share-modal__link">
                <input readOnly value={calendarFeedUrl(token)} onFocus={e => e.target.select()} />
                <button className="btn btn--primary" onClick={copy}>
                  {copied ? t('share.copied') : t('share.copy')}
                </button>
              </div>
              <a className="share-modal__hint export-modal__webcal" href={calendarWebcalUrl(token)}>
                {t('export.openInCalendar')}
              </a>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={makeLink} disabled={busy !== null}>
              🔗 {busy === 'link' ? t('export.preparing') : t('export.createSyncLink')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
