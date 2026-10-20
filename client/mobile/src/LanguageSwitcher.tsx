import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n';
import { theme } from './theme';

// F30: compact EN/ES/DE selector. The choice persists (AsyncStorage) and the shared formatters
// follow it, so it only needs to live on the home screen.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <View style={styles.row}>
      <Text style={styles.globe}>🌐</Text>
      {LANGUAGES.map(l => {
        const active = i18n.language.startsWith(l.code);
        return (
          <TouchableOpacity
            key={l.code}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => i18n.changeLanguage(l.code)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{l.code.toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  globe: { fontSize: 14, marginRight: 2 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipActive: { backgroundColor: theme.accentBg, borderColor: theme.accent },
  text: { fontSize: 12, fontWeight: '600', color: theme.text },
  textActive: { color: theme.accent },
});
