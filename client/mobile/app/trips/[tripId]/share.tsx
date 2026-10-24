import { useCallback, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getTrip, setTripVisibility, createShareLink, revokeShareLink } from '../../../src/api';
import { theme } from '../../../src/theme';

// The web app that renders a share link. Configurable like the API base; falls back to the local dev
// web server.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:5173';
const shareUrl = (token: string) => `${WEB_URL}/shared/${token}`;

// F26: the owner's share controls — publish to the public gallery and mint/share/revoke a read-only
// link, opened from the itinerary header.
export default function ShareScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [isPublic, setIsPublic] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!tripId) return;
    return getTrip(tripId)
      .then(trip => { setIsPublic(trip.isPublic); setToken(trip.shareToken ?? null); })
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function togglePublic(next: boolean) {
    if (!tripId) return;
    setIsPublic(next);
    setBusy(true);
    try {
      await setTripVisibility(tripId, next);
    } catch {
      setIsPublic(!next);
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (!tripId) return;
    setBusy(true);
    try {
      let current = token;
      if (!current) {
        const link = await createShareLink(tripId);
        current = link.shareToken;
        setToken(current);
      }
      await Share.share({ message: shareUrl(current) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!tripId) return;
    setBusy(true);
    try {
      await revokeShareLink(tripId);
      setToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('share.title') }} />
      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : (
        <View style={styles.content}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('share.listInGallery')}</Text>
              <Text style={styles.hint}>{t('share.listInGalleryHint')}</Text>
            </View>
            <Switch value={isPublic} onValueChange={togglePublic} disabled={busy} />
          </View>

          <View style={styles.section}>
            <Text style={styles.rowTitle}>{t('share.linkTitle')}</Text>
            <Text style={styles.hint}>{t('share.linkHint')}</Text>
            <TouchableOpacity style={styles.primary} onPress={shareLink} disabled={busy}>
              <Text style={styles.primaryText}>🔗 {token ? t('share.copy') : t('share.createLink')}</Text>
            </TouchableOpacity>
            {token ? (
              <TouchableOpacity onPress={revoke} disabled={busy}>
                <Text style={styles.revoke}>{t('share.revoke')}</Text>
              </TouchableOpacity>
            ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.textStrong },
  hint: { fontSize: 13, color: theme.text },
  section: { gap: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 20 },
  primary: { backgroundColor: theme.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  revoke: { color: theme.danger, fontSize: 13, marginTop: 4 },
});
