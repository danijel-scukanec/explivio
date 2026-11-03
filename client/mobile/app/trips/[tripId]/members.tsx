import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TripMember, TripRole } from '@explivio/shared';
import {
  getTrip, getTripMembers, getMemberRole, inviteMember, setMemberRole, removeMember,
} from '../../../src/api';
import { theme } from '../../../src/theme';

const ROLES: TripRole[] = ['Owner', 'Editor', 'Viewer'];

// F15: manage who can see/edit a trip (the mobile counterpart of the web Members panel). Owners can
// invite by email, change roles and remove members; everyone else sees a read-only list. The API
// enforces the same rules (incl. the last-owner guard) and its error title is surfaced here.
export default function MembersScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [tripName, setTripName] = useState('');
  const [members, setMembers] = useState<TripMember[]>([]);
  const [callerRole, setCallerRole] = useState<TripRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TripRole>('Editor');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getTripMembers(tripId), getMemberRole(tripId)])
      .then(([trip, m, r]) => { setTripName(trip.name); setMembers(m); setCallerRole(r); setError(null); })
      .catch(() => setError(t('members.loadError')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isOwner = callerRole === 'Owner';
  const roleLabel = (role: TripRole) => t(`members.role${role}`);

  async function run(action: () => Promise<unknown>, fallbackKey: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(fallbackKey));
    } finally {
      setBusy(false);
    }
  }

  function handleInvite() {
    const email = inviteEmail.trim();
    if (!tripId || !email) return;
    void run(async () => {
      await inviteMember(tripId, email, inviteRole);
      setInviteEmail('');
    }, 'members.inviteError');
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: tripName ? `${tripName} · ${t('members.title')}` : t('members.title') }} />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}

          {members.map(m => (
            <View key={m.userId} style={styles.row}>
              <View style={styles.person}>
                <Text style={styles.name}>{m.displayName || m.email || m.userId.slice(0, 8)}</Text>
                {!!m.email && <Text style={styles.email}>{m.email}</Text>}
              </View>

              {isOwner ? (
                <View style={styles.controls}>
                  <RolePicker
                    value={m.role}
                    disabled={busy}
                    onChange={role => run(() => setMemberRole(tripId!, m.userId, role), 'members.roleError')}
                    label={roleLabel}
                  />
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => run(() => removeMember(tripId!, m.userId), 'members.removeError')}
                    hitSlop={8}
                  >
                    <Text style={styles.remove}>{t('members.remove')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.roleTag}>{roleLabel(m.role)}</Text>
              )}
            </View>
          ))}

          {isOwner && (
            <View style={styles.invite}>
              <Text style={styles.inviteHead}>{t('members.invite')}</Text>
              <TextInput
                style={styles.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder={t('members.emailPlaceholder')}
                placeholderTextColor={theme.text}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleInvite}
              />
              <RolePicker value={inviteRole} disabled={busy} onChange={setInviteRole} label={roleLabel} />
              <TouchableOpacity
                style={[styles.inviteBtn, (busy || !inviteEmail.trim()) && styles.btnDisabled]}
                onPress={handleInvite}
                disabled={busy || !inviteEmail.trim()}
              >
                <Text style={styles.inviteBtnText}>{t('members.invite')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// A compact segmented role selector (mobile stand-in for the web <select>).
function RolePicker({ value, disabled, onChange, label }: {
  value: TripRole;
  disabled: boolean;
  onChange: (role: TripRole) => void;
  label: (role: TripRole) => string;
}) {
  return (
    <View style={styles.segment}>
      {ROLES.map(role => {
        const active = role === value;
        return (
          <TouchableOpacity
            key={role}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            disabled={disabled || active}
            onPress={() => onChange(role)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label(role)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  center: { marginTop: 40 },
  error: { color: theme.danger, marginBottom: 12, textAlign: 'center' },
  row: {
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  person: { marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '700', color: theme.textStrong },
  email: { fontSize: 13, color: theme.text, marginTop: 2 },
  controls: { gap: 10 },
  roleTag: { fontSize: 14, fontWeight: '600', color: theme.accent },
  remove: { color: theme.danger, fontWeight: '700', alignSelf: 'flex-start' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: theme.border, borderRadius: 8, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: theme.bg },
  segmentBtnActive: { backgroundColor: theme.accent },
  segmentText: { fontSize: 13, color: theme.text, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  invite: {
    marginTop: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, padding: 14, gap: 10,
  },
  inviteHead: { fontSize: 16, fontWeight: '700', color: theme.textStrong },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: theme.textStrong, backgroundColor: theme.bg,
  },
  inviteBtn: { backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  inviteBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
