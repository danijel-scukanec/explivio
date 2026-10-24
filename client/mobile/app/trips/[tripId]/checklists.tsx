import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Checklist } from '@explivio/shared';
import {
  getTrip, getChecklists, createChecklist, deleteChecklist,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '../../../src/api';
import { theme } from '../../../src/theme';

// F24: packing lists / checklists — several named lists per trip, each with checkable items. Mutations
// go through the offline-aware api layer, so ticking an item works on a plane and syncs on reconnect.
export default function ChecklistsScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [tripName, setTripName] = useState('');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');

  const load = useCallback(() => {
    if (!tripId) return;
    return Promise.all([getTrip(tripId), getChecklists(tripId)])
      .then(([trip, lists]) => { setTripName(trip.name); setChecklists(lists); setError(null); })
      .catch(() => setError(t('checklists.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAddList() {
    const name = newListName.trim();
    if (!tripId || !name) return;
    setNewListName('');
    await createChecklist(tripId, name);
    load();
  }

  async function handleDeleteList(id: string) {
    if (!tripId) return;
    await deleteChecklist(tripId, id);
    load();
  }

  async function handleToggle(list: Checklist, itemId: string, isChecked: boolean, text: string) {
    if (!tripId) return;
    setChecklists(cs => cs.map(c => c.id === list.id
      ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, isChecked } : i) }
      : c));
    try {
      await updateChecklistItem(tripId, list.id, itemId, text, isChecked);
    } catch {
      load();
    }
  }

  async function handleAddItem(listId: string, text: string) {
    if (!tripId || !text.trim()) return;
    await addChecklistItem(tripId, listId, text.trim());
    load();
  }

  async function handleDeleteItem(listId: string, itemId: string) {
    if (!tripId) return;
    await deleteChecklistItem(tripId, listId, itemId);
    load();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: tripName || t('checklists.title') }} />

      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.accent} />
      ) : error ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.newList}>
            <TextInput
              style={styles.newListInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder={t('checklists.newListPlaceholder')}
              placeholderTextColor={theme.text}
              maxLength={200}
              returnKeyType="done"
              onSubmitEditing={handleAddList}
            />
            <TouchableOpacity
              style={[styles.addListBtn, !newListName.trim() && styles.btnDisabled]}
              onPress={handleAddList}
              disabled={!newListName.trim()}
            >
              <Text style={styles.addListBtnText}>{t('checklists.addList')}</Text>
            </TouchableOpacity>
          </View>

          {checklists.length === 0 ? (
            <Text style={styles.empty}>{t('checklists.empty')}</Text>
          ) : (
            checklists.map(list => (
              <ChecklistCard
                key={list.id}
                list={list}
                onDeleteList={handleDeleteList}
                onToggle={handleToggle}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ChecklistCard({ list, onDeleteList, onToggle, onAddItem, onDeleteItem }: {
  list: Checklist;
  onDeleteList: (id: string) => void;
  onToggle: (list: Checklist, itemId: string, isChecked: boolean, text: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onDeleteItem: (listId: string, itemId: string) => void;
}) {
  const { t } = useTranslation();
  const [newItem, setNewItem] = useState('');
  const done = list.items.filter(i => i.isChecked).length;

  function submit() {
    if (!newItem.trim()) return;
    onAddItem(list.id, newItem);
    setNewItem('');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.listName}>{list.name}</Text>
        <Text style={styles.count}>{done}/{list.items.length}</Text>
        <TouchableOpacity onPress={() => onDeleteList(list.id)} hitSlop={8}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>

      {list.items.map(item => (
        <View key={item.id} style={styles.item}>
          <TouchableOpacity
            style={styles.itemTap}
            onPress={() => onToggle(list, item.id, !item.isChecked, item.text)}
          >
            <Text style={styles.checkbox}>{item.isChecked ? '☑' : '☐'}</Text>
            <Text style={[styles.itemText, item.isChecked && styles.itemTextDone]}>{item.text}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDeleteItem(list.id, item.id)} hitSlop={8}>
            <Text style={styles.itemDelete}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.addItem}>
        <TextInput
          style={styles.addItemInput}
          value={newItem}
          onChangeText={setNewItem}
          placeholder={t('checklists.newItemPlaceholder')}
          placeholderTextColor={theme.text}
          maxLength={500}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <TouchableOpacity onPress={submit} disabled={!newItem.trim()} hitSlop={8}>
          <Text style={[styles.addItemBtn, !newItem.trim() && styles.btnDisabled]}>{t('checklists.addItem')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  center: { textAlign: 'center', marginTop: 40, color: theme.text, paddingHorizontal: 24 },
  error: { color: theme.danger },
  empty: { textAlign: 'center', color: theme.text, marginTop: 24, paddingHorizontal: 24 },
  newList: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newListInput: {
    flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, color: theme.textStrong, backgroundColor: theme.card,
  },
  addListBtn: { backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  addListBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  card: {
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
    padding: 14, marginBottom: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  listName: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.textStrong },
  count: { fontSize: 13, color: theme.accent, fontVariant: ['tabular-nums'] },
  delete: { color: theme.danger, fontSize: 15 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  itemTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { fontSize: 18, color: theme.accent },
  itemText: { flex: 1, fontSize: 14, color: theme.textStrong },
  itemTextDone: { textDecorationLine: 'line-through', color: theme.text },
  itemDelete: { color: theme.text, fontSize: 14, paddingHorizontal: 4 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addItemInput: {
    flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, color: theme.textStrong, backgroundColor: theme.bg,
  },
  addItemBtn: { color: theme.accent, fontWeight: '700', paddingHorizontal: 4 },
});
