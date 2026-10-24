import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, TripDocument } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import { getDocuments, uploadDocument, deleteDocument, documentContentUrl } from '../services/documentsApi';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './DocumentsPage.css';

// A human-readable size: bytes → "12 KB", "3.4 MB".
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fileIcon(contentType: string): string {
  if (contentType === 'application/pdf') return '📄';
  if (contentType.startsWith('image/')) return '🖼️';
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') return '📊';
  if (contentType.includes('word') || contentType.includes('msword')) return '📝';
  return '📎';
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, docs] = await Promise.all([getTrip(tripId), getDocuments(tripId)]);
      setTrip(tripData);
      setDocuments(docs);
    } catch {
      setError(t('documents.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  // F15: live collaboration — refetch when another member adds or removes a document.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!tripId || !file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadDocument(tripId, file);
      await load();
    } catch {
      setError(t('documents.couldNotUpload'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tripId) return;
    await deleteDocument(tripId, id);
    load();
  }

  if (loading) return <div className="documents-page"><p className="documents-page__status">{t('common.loading')}</p></div>;
  if (error && !trip) return <div className="documents-page"><p className="documents-page__status documents-page__status--error">{error}</p></div>;
  if (!trip) return <div className="documents-page"><p className="documents-page__status documents-page__status--error">{t('documents.notFound')}</p></div>;

  return (
    <div className="documents-page">
      <div className="documents-page__header">
        <div className="documents-page__back">
          <Link to="/trips">← Trips</Link>
          <h1>{trip.name}</h1>
          <span className="documents-page__destination">{trip.destination}</span>
          {othersViewing > 0 && (
            <span className="documents-page__presence" title={presentUserIds.join(', ')}>
              <span className="documents-page__presence-dot" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        <div className="documents-page__actions">
          <Link className="btn btn--ghost" to={`/trips/${tripId}/itinerary`}>🗓 {t('documents.itinerary')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/checklists`}>✅ {t('documents.checklists')}</Link>
          <LanguageSwitcher />
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleUpload}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.csv,.doc,.docx,.xls,.xlsx"
          />
          <button
            className="btn btn--primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? t('documents.uploading') : t('documents.upload')}
          </button>
        </div>
      </div>

      {error && <p className="documents-page__status documents-page__status--error">{error}</p>}

      {documents.length === 0
        ? <p className="documents-page__empty">{t('documents.empty')}</p>
        : (
          <ul className="documents-page__list">
            {documents.map(doc => (
              <li key={doc.id} className="document">
                <span className="document__icon" aria-hidden="true">{fileIcon(doc.contentType)}</span>
                <a
                  className="document__name"
                  href={documentContentUrl(tripId!, doc.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {doc.fileName}
                </a>
                <span className="document__meta">{formatSize(Number(doc.sizeBytes))} · {formatTripDate(doc.uploadedAt)}</span>
                <button
                  type="button"
                  className="document__delete"
                  onClick={() => handleDelete(doc.id)}
                  aria-label={t('documents.delete')}
                  title={t('documents.delete')}
                >✕</button>
              </li>
            ))}
          </ul>
        )
      }
    </div>
  );
}
