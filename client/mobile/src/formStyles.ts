import { StyleSheet } from 'react-native';
import { theme } from './theme';

// Shared styling for the create/add form screens so they stay consistent.
export const formStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 14 },
  label: { fontSize: 13, color: theme.text, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.textStrong,
    backgroundColor: theme.bg,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  error: { color: theme.danger, fontSize: 13 },
  submit: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: theme.accentBg, borderColor: theme.accent },
  chipText: { fontSize: 13, color: theme.text },
  chipTextActive: { color: theme.accent, fontWeight: '600' },
});
