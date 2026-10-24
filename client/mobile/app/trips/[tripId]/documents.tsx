import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import type { TripDocument } from '@explivio/shared';
import { formatTripDate } from '@explivio/shared';
import { getTrip, getDocuments, uploadDocument, deleteDocument, documentContentUrl } from '../../../src/api';
import { theme } from '../../../src/theme';

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

// F24: Blob-backed trip documents. Upload picks a file with the OS document picker and posts it
// multipart (online-only — binary bodies don't fit the offline replay queue). Tapping a document
// opens it via the content endpoint in the system viewer/browser.
export default function DocumentsScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [tripName, setTripName] = useState('');
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getDocuments(tripId)])
      .then(([trip, docs]) => { setTripName(trip.name); setDocuments(docs); setError(null); })
      .catch(() => setError(t('documents.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleUpload() {
    if (!tripId) return;
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setError(null);
    setUploading(true);
    try {
      await uploadDocument(tripId, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
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

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: tripName || t('documents.title'),
          headerRight: () => (
            <TouchableOpacity onPress={handleUpload} hitSlop={10} disabled={uploading}>
              <Text style={styles.headerButton}>
                {uploading ? t('documents.uploading') : t('documents.upload')}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error && documents.length === 0 ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : documents.length === 0 ? (
        <Text style={styles.center}>{t('documents.empty')}</Text>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <Text style={[styles.error, styles.listError]}>{error}</Text> : null}
          renderItem={({ item: doc }) => (
            <View style={styles.card}>
              <Text style={styles.icon}>{fileIcon(doc.contentType)}</Text>
              <TouchableOpacity
                style={styles.body}
                onPress={() => Linking.openURL(documentContentUrl(tripId!, doc.id))}
              >
                <Text style={styles.name} numberOfLines={1}>{doc.fileName}</Text>
                <Text style={styles.meta}>{formatSize(Number(doc.sizeBytes))} · {formatTripDate(doc.uploadedAt)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(doc.id)} hitSlop={8}>
                <Text style={styles.delete}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 16 },
  listError: { marginBottom: 12 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
  headerButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  icon: { fontSize: 20 },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  meta: { fontSize: 13, color: theme.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  delete: { color: theme.danger, fontSize: 15 },
});
