import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripDocument } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getDocuments, uploadDocument, deleteDocument, downloadDocument } from '../services/documentsApi';
import { useTrip } from '../../trips/pages/TripLayout';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { Button } from '@/components/ui/button';

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
  const { tripId, changeSignal } = useTrip();
  const confirm = useConfirm();
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await getDocuments(tripId));
    } catch {
      setError(t('documents.couldNotLoad'));
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load, changeSignal]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
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
    if (!(await confirm())) return;
    await deleteDocument(tripId, id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={handleUpload}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.csv,.doc,.docx,.xls,.xlsx"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? t('documents.uploading') : t('documents.upload')}
        </Button>
      </div>

      {error && <p className="text-destructive mb-3 text-sm">{error}</p>}

      {documents.length === 0
        ? <p className="text-muted-foreground text-sm">{t('documents.empty')}</p>
        : (
          <ul className="flex max-w-[720px] flex-col gap-2">
            {documents.map(doc => (
              <li key={doc.id} className="group bg-card flex items-center gap-3 rounded-xl border px-3.5 py-3">
                <span className="text-xl leading-none" aria-hidden="true">{fileIcon(doc.contentType)}</span>
                <button
                  type="button"
                  className="text-card-foreground hover:text-primary flex-1 truncate text-left text-sm font-medium hover:underline"
                  onClick={() => downloadDocument(tripId, doc.id, doc.fileName)}
                >
                  {doc.fileName}
                </button>
                <span className="text-muted-foreground text-[13px] whitespace-nowrap tabular-nums">{formatSize(Number(doc.sizeBytes))} · {formatTripDate(doc.uploadedAt)}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive rounded p-1 text-sm opacity-0 group-hover:opacity-50 hover:!opacity-100"
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
