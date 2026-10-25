import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getTrip, createShareLink, fetchItineraryIcs, calendarFeedUrl, calendarWebcalUrl,
} from '../../../src/api';
import { theme } from '../../../src/theme';

// F27: export / calendar-sync for a trip. Download the itinerary as an .ics file (shared via the OS
// share sheet) or subscribe to a live feed Google/Outlook/Apple Calendar poll. The feed reuses the
// F26 share token, minted here on demand. (PDF export is web-only — see fetchItineraryIcs.)
export default function ExportScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!tripId) return;
    return getTrip(tripId)
      .then(trip => setToken(trip.shareToken ?? null))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function downloadIcs() {
    if (!tripId) return;
    setBusy(true);
    try {
      const ics = await fetchItineraryIcs(tripId);
      await Share.share({ message: ics, title: t('export.downloadIcs') });
    } finally {
      setBusy(false);
    }
  }

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    if (!tripId) return null;
    const link = await createShareLink(tripId);
    setToken(link.shareToken);
    return link.shareToken;
  }

  async function shareFeed() {
    setBusy(true);
    try {
      const current = await ensureToken();
      if (current) await Share.share({ message: calendarFeedUrl(current) });
    } finally {
      setBusy(false);
    }
  }

  async function openInCalendar() {
    setBusy(true);
    try {
      const current = await ensureToken();
      if (current) await Linking.openURL(calendarWebcalUrl(current));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('export.title') }} />
      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.rowTitle}>{t('export.downloadTitle')}</Text>
            <Text style={styles.hint}>{t('export.downloadHint')}</Text>
            <TouchableOpacity style={styles.primary} onPress={downloadIcs} disabled={busy}>
              <Text style={styles.primaryText}>📅 {t('export.downloadIcs')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.rowTitle}>{t('export.syncTitle')}</Text>
            <Text style={styles.hint}>{t('export.syncHint')}</Text>
            {token ? <Text style={styles.url} selectable>{calendarFeedUrl(token)}</Text> : null}
            <TouchableOpacity style={styles.primary} onPress={openInCalendar} disabled={busy}>
              <Text style={styles.primaryText}>📆 {t('export.openInCalendar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghost} onPress={shareFeed} disabled={busy}>
              <Text style={styles.ghostText}>🔗 {token ? t('share.copy') : t('export.createSyncLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  center: { marginTop: 40 },
  content: { padding: 20, gap: 20 },
  section: { gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  hint: { fontSize: 13, color: theme.text },
  url: { fontSize: 12, color: theme.text, fontFamily: 'monospace' },
  primary: { backgroundColor: theme.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghost: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: theme.textStrong, fontWeight: '600', fontSize: 15 },
});
