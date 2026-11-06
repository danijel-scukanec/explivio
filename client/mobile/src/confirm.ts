import { Alert } from 'react-native';

// A native "are you sure?" guard for destructive actions, mirroring the web app's delete confirmation.
// Pass the screen's `t` so the buttons are translated. The action runs only if the user confirms.
export function confirmDelete(t: (key: string) => string, onConfirm: () => void | Promise<void>): void {
  Alert.alert(t('mobile.confirmDeleteTitle'), t('mobile.confirmDeleteBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('mobile.delete'), style: 'destructive', onPress: () => { void onConfirm(); } },
  ]);
}
