import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { authEnabled, useAuth } from './AuthProvider';
import { theme } from './theme';

// P-Auth: when Entra auth is enabled and the user isn't signed in, cover the app with a sign-in
// screen. Rendered as an overlay (not a replacement) so expo-router's navigator stays mounted
// underneath. No-op when auth is disabled — the dev-identity flow is untouched.
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isAuthenticated, ready, signIn } = useAuth();

  return (
    <>
      {children}
      {authEnabled && !isAuthenticated && (
        <View style={styles.overlay}>
          <Text style={styles.brand}>Explivio</Text>
          <Text style={styles.hint}>{t('auth.hint')}</Text>
          <Pressable
            style={[styles.btn, !ready && styles.btnDisabled]}
            onPress={signIn}
            disabled={!ready}
          >
            <Text style={styles.btnText}>{ready ? t('auth.signIn') : t('auth.loading')}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.bg,
    zIndex: 100,
  },
  brand: { fontSize: 32, fontWeight: '800', color: theme.textStrong, marginBottom: 8 },
  hint: { fontSize: 15, color: theme.text, marginBottom: 28, textAlign: 'center' },
  btn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
