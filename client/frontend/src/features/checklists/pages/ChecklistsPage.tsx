import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Checklist } from '@explivio/shared';
import {
  getChecklists, createChecklist, deleteChecklist,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '../services/checklistsApi';
import { useTrip } from '../../trips/pages/TripLayout';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function ChecklistsPage() {
  const { t } = useTranslation();
  const { tripId, changeSignal } = useTrip();
  const confirm = useConfirm();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setChecklists(await getChecklists(tripId));
    } catch {
      setError(t('checklists.couldNotLoad'));
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load, changeSignal]);

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setNewListName('');
    await createChecklist(tripId, { tripId, name });
    load();
  }

  async function handleDeleteList(id: string) {
    if (!(await confirm())) return;
    await deleteChecklist(tripId, id);
    load();
  }

  // Optimistic toggle — flip locally, then persist; collaboration nudges other viewers.
  async function handleToggle(list: Checklist, itemId: string, isChecked: boolean, text: string) {
    setChecklists(cs => cs.map(c => c.id === list.id
      ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, isChecked } : i) }
      : c));
    try {
      await updateChecklistItem(tripId, list.id, itemId, { tripId, checklistId: list.id, id: itemId, text, isChecked });
    } catch {
      load(); // revert to server truth on failure
    }
  }

  async function handleAddItem(listId: string, text: string) {
    if (!text.trim()) return;
    await addChecklistItem(tripId, listId, { tripId, checklistId: listId, text: text.trim() });
    load();
  }

  async function handleDeleteItem(listId: string, itemId: string) {
    await deleteChecklistItem(tripId, listId, itemId);
    load();
  }

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div>
      <form className="mb-6 flex max-w-[480px] gap-2" onSubmit={handleAddList}>
        <Input
          className="flex-1"
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
          placeholder={t('checklists.newListPlaceholder')}
          maxLength={200}
        />
        <Button type="submit" disabled={!newListName.trim()}>{t('checklists.addList')}</Button>
      </form>

      {checklists.length === 0
        ? <p className="text-muted-foreground text-sm">{t('checklists.empty')}</p>
        : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-4">
            {checklists.map(list => (
              <ChecklistCard
                key={list.id}
                list={list}
                onDeleteList={handleDeleteList}
                onToggle={handleToggle}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
              />
            ))}
          </div>
        )
      }
    </div>
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

  function submitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    onAddItem(list.id, newItem);
    setNewItem('');
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-card-foreground flex-1 text-base font-semibold">{list.name}</h2>
        <span className="text-primary text-[13px] tabular-nums">{done}/{list.items.length}</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive rounded p-1 text-sm opacity-50 hover:opacity-100"
          onClick={() => onDeleteList(list.id)}
          aria-label={t('checklists.deleteList')}
          title={t('checklists.deleteList')}
        >✕</button>
      </div>

      <ul className="flex flex-col gap-0.5">
        {list.items.map(item => (
          <li key={item.id} className="group flex items-center gap-1.5 px-0.5 py-1">
            <label className="text-card-foreground flex flex-1 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={item.isChecked}
                onChange={e => onToggle(list, item.id, e.target.checked, item.text)}
              />
              <span className={cn(item.isChecked && 'line-through opacity-55')}>{item.text}</span>
            </label>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive rounded p-1 text-sm opacity-0 group-hover:opacity-50 hover:!opacity-100"
              onClick={() => onDeleteItem(list.id, item.id)}
              aria-label={t('checklists.deleteItem')}
              title={t('checklists.deleteItem')}
            >✕</button>
          </li>
        ))}
      </ul>

      <form className="flex gap-1.5" onSubmit={submitItem}>
        <Input
          className="h-8 flex-1"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={t('checklists.newItemPlaceholder')}
          maxLength={500}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!newItem.trim()}>{t('checklists.addItem')}</Button>
      </form>
    </Card>
  );
}
