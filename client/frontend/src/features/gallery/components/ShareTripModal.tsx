import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setTripVisibility, createShareLink, revokeShareLink, shareUrl } from '../services/galleryApi';
import { Modal, ModalBody } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// F26: the owner's share controls for a trip — list it in the public gallery, and mint/copy/revoke a
// read-only share link. Opened from the itinerary header; reports changes back so the page can refresh
// the trip (isPublic / shareToken live on the trip).
export function ShareTripModal({ tripId, isPublic, shareToken, onClose, onChanged }: {
  tripId: string;
  isPublic: boolean;
  shareToken: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [publicOn, setPublicOn] = useState(isPublic);
  const [token, setToken] = useState<string | null>(shareToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function togglePublic() {
    const next = !publicOn;
    setPublicOn(next);
    setBusy(true);
    try {
      await setTripVisibility(tripId, next);
      onChanged();
    } catch {
      setPublicOn(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  async function makeLink() {
    setBusy(true);
    try {
      const link = await createShareLink(tripId);
      setToken(link.shareToken);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await revokeShareLink(tripId);
      setToken(null);
      setCopied(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the link is shown for manual copy */ }
  }

  return (
    <Modal title={t('share.title')} onClose={onClose}>
      <ModalBody>
        <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="accent-primary mt-0.5 size-4" checked={publicOn} onChange={togglePublic} disabled={busy} />
          <span className="flex flex-col gap-0.5">
            <strong className="text-card-foreground text-sm">{t('share.listInGallery')}</strong>
            <span className="text-muted-foreground text-xs">{t('share.listInGalleryHint')}</span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <strong className="text-card-foreground text-sm">{t('share.linkTitle')}</strong>
          <span className="text-muted-foreground text-xs">{t('share.linkHint')}</span>
          {token ? (
            <>
              <div className="flex gap-2">
                <Input readOnly className="flex-1" value={shareUrl(token)} onFocus={e => e.target.select()} />
                <Button onClick={copy}>{copied ? t('share.copied') : t('share.copy')}</Button>
              </div>
              <Button variant="link" className="text-destructive self-start px-0" onClick={revoke} disabled={busy}>
                {t('share.revoke')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="self-start" onClick={makeLink} disabled={busy}>
              🔗 {t('share.createLink')}
            </Button>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
