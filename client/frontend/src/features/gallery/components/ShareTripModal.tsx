import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setTripVisibility, createShareLink, revokeShareLink, shareUrl } from '../services/galleryApi';
import './ShareTripModal.css';

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
    <div className="share-modal__overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal__head">
          <h2>{t('share.title')}</h2>
          <button className="share-modal__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <label className="share-modal__row">
          <input type="checkbox" checked={publicOn} onChange={togglePublic} disabled={busy} />
          <span>
            <strong>{t('share.listInGallery')}</strong>
            <span className="share-modal__hint">{t('share.listInGalleryHint')}</span>
          </span>
        </label>

        <div className="share-modal__section">
          <strong>{t('share.linkTitle')}</strong>
          <span className="share-modal__hint">{t('share.linkHint')}</span>
          {token ? (
            <>
              <div className="share-modal__link">
                <input readOnly value={shareUrl(token)} onFocus={e => e.target.select()} />
                <button className="btn btn--primary" onClick={copy}>
                  {copied ? t('share.copied') : t('share.copy')}
                </button>
              </div>
              <button className="share-modal__revoke" onClick={revoke} disabled={busy}>
                {t('share.revoke')}
              </button>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={makeLink} disabled={busy}>
              🔗 {t('share.createLink')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
