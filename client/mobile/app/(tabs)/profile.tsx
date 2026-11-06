import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../src/i18n';
import type { Theme } from '../../src/theme';
import { useThemedStyles } from '../../src/useTheme';
import { useThemeState, type ThemePreference } from '../../src/ThemeProvider';
import { useAuth, authEnabled } from '../../src/AuthProvider';

const THEME_OPTIONS: { value: ThemePreference; labelKey: string }[] = [
  { value: 'system', labelKey: 'settings.themeSystem' },
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { preference, setPreference } = useThemeState();
  const { isAuthenticated, user, signOut } = useAuth();

  const displayName = user?.name || user?.email || t('settings.devUser');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Account */}
      <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.accountText}>
          <Text style={styles.name}>{displayName}</Text>
          {user?.email && user?.name ? <Text style={styles.sub}>{user.email}</Text> : null}
          {!authEnabled ? <Text style={styles.sub}>{t('settings.devHint')}</Text> : null}
        </View>
      </View>
      {authEnabled && isAuthenticated ? (
        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Appearance */}
      <Text style={styles.sectionLabel}>{t('settings.appearance')}</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map(opt => {
          const active = preference === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setPreference(opt.value)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(opt.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Language */}
      <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
      <View style={styles.segment}>
        {LANGUAGES.map(l => {
          const active = i18n.language.startsWith(l.code);
          return (
            <TouchableOpacity
              key={l.code}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => i18n.changeLanguage(l.code)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: theme.text, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 16, marginBottom: 4,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  accountText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: theme.textStrong },
  sub: { fontSize: 13, color: theme.text },
  signOut: {
    marginTop: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center',
  },
  signOutText: { color: theme.danger, fontSize: 15, fontWeight: '600' },
  segment: {
    flexDirection: 'row', gap: 8, padding: 4, borderRadius: 12,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentItemActive: { backgroundColor: theme.accentBg },
  segmentText: { fontSize: 14, fontWeight: '600', color: theme.text },
  segmentTextActive: { color: theme.accent },
});
