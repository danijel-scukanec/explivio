import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadItinerary, calendarFeedUrl, calendarWebcalUrl } from '../services/calendarApi';
import { createShareLink } from '../../gallery/services/galleryApi';
import { Modal, ModalBody } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <Modal title={t('export.title')} onClose={onClose}>
      <ModalBody>
        <div className="flex flex-col gap-2">
          <strong className="text-card-foreground text-sm">{t('export.downloadTitle')}</strong>
          <span className="text-muted-foreground text-xs">{t('export.downloadHint')}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => download('ics')} disabled={busy !== null}>
              📅 {busy === 'ics' ? t('export.preparing') : t('export.downloadIcs')}
            </Button>
            <Button variant="secondary" onClick={() => download('pdf')} disabled={busy !== null}>
              📄 {busy === 'pdf' ? t('export.preparing') : t('export.downloadPdf')}
            </Button>
          </div>
          {error && <span className="text-destructive text-xs">{t('export.failed')}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <strong className="text-card-foreground text-sm">{t('export.syncTitle')}</strong>
          <span className="text-muted-foreground text-xs">{t('export.syncHint')}</span>
          {token ? (
            <>
              <div className="flex gap-2">
                <Input readOnly className="flex-1" value={calendarFeedUrl(token)} onFocus={e => e.target.select()} />
                <Button onClick={copy}>{copied ? t('share.copied') : t('share.copy')}</Button>
              </div>
              <a className="text-primary text-xs hover:underline" href={calendarWebcalUrl(token)}>
                {t('export.openInCalendar')}
              </a>
            </>
          ) : (
            <Button variant="secondary" className="self-start" onClick={makeLink} disabled={busy !== null}>
              🔗 {busy === 'link' ? t('export.preparing') : t('export.createSyncLink')}
            </Button>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
