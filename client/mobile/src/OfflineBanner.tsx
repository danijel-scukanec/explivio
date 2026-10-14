import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from './useOnline';
import { theme } from './theme';

// F31: a thin bar shown only when the device is offline or there are changes waiting to sync.
// It sits at the very top of the app (above each screen's header), so it pads itself past the
// status bar / notch with the top safe-area inset.
export function OfflineBanner() {
  const { online, pending } = useOnline();
  const insets = useSafeAreaInsets();
  if (online && pending === 0) return null;

  const text = !online
    ? pending > 0
      ? `Offline — ${pending} change${pending > 1 ? 's' : ''} will sync later`
      : 'Offline — showing saved data'
    : `Syncing ${pending} change${pending > 1 ? 's' : ''}…`;

  return (
    <View
      style={[
        styles.banner,
        online ? styles.syncing : styles.offline,
        { paddingTop: insets.top + 6 },
      ]}
    >
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingBottom: 6, paddingHorizontal: 16, alignItems: 'center' },
  offline: { backgroundColor: '#6b6375' },
  syncing: { backgroundColor: theme.accent },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
