import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip, Checklist } from '@explivio/shared';
import { getTrip } from '../../trips/services/tripsApi';
import {
  getChecklists, createChecklist, deleteChecklist,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '../services/checklistsApi';
import { useTripCollaboration } from '../../../shared/hooks/useTripCollaboration';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import './ChecklistsPage.css';

export function ChecklistsPage() {
  const { t } = useTranslation();
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');

  async function load() {
    if (!tripId) return;
    setError(null);
    try {
      const [tripData, lists] = await Promise.all([getTrip(tripId), getChecklists(tripId)]);
      setTrip(tripData);
      setChecklists(lists);
    } catch {
      setError(t('checklists.couldNotLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  // F15: live collaboration — refetch when another member changes a list.
  const { presentUserIds } = useTripCollaboration(tripId, load);
  const othersViewing = Math.max(0, presentUserIds.length - 1);

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    const name = newListName.trim();
    if (!tripId || !name) return;
    setNewListName('');
    await createChecklist(tripId, { tripId, name });
    load();
  }

  async function handleDeleteList(id: string) {
    if (!tripId) return;
    await deleteChecklist(tripId, id);
    load();
  }

  // Optimistic toggle — flip locally, then persist; collaboration nudges other viewers.
  async function handleToggle(list: Checklist, itemId: string, isChecked: boolean, text: string) {
    if (!tripId) return;
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
    if (!tripId || !text.trim()) return;
    await addChecklistItem(tripId, listId, { tripId, checklistId: listId, text: text.trim() });
    load();
  }

  async function handleDeleteItem(listId: string, itemId: string) {
    if (!tripId) return;
    await deleteChecklistItem(tripId, listId, itemId);
    load();
  }

  if (loading) return <div className="checklists-page"><p className="checklists-page__status">{t('common.loading')}</p></div>;
  if (error || !trip) return <div className="checklists-page"><p className="checklists-page__status checklists-page__status--error">{error ?? t('checklists.notFound')}</p></div>;

  return (
    <div className="checklists-page">
      <div className="checklists-page__header">
        <div className="checklists-page__back">
          <Link to="/trips">← Trips</Link>
          <h1>{trip.name}</h1>
          <span className="checklists-page__destination">{trip.destination}</span>
          {othersViewing > 0 && (
            <span className="checklists-page__presence" title={presentUserIds.join(', ')}>
              <span className="checklists-page__presence-dot" aria-hidden="true" />
              {t('itinerary.othersViewing', { count: othersViewing })}
            </span>
          )}
        </div>
        <div className="checklists-page__actions">
          <Link className="btn btn--ghost" to={`/trips/${tripId}/itinerary`}>🗓 {t('checklists.itinerary')}</Link>
          <Link className="btn btn--ghost" to={`/trips/${tripId}/documents`}>📎 {t('checklists.documents')}</Link>
          <LanguageSwitcher />
        </div>
      </div>

      <form className="checklists-page__new" onSubmit={handleAddList}>
        <input
          className="checklists-page__new-input"
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
          placeholder={t('checklists.newListPlaceholder')}
          maxLength={200}
        />
        <button type="submit" className="btn btn--primary" disabled={!newListName.trim()}>
          {t('checklists.addList')}
        </button>
      </form>

      {checklists.length === 0
        ? <p className="checklists-page__empty">{t('checklists.empty')}</p>
        : (
          <div className="checklists-page__lists">
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
    <section className="checklist">
      <div className="checklist__head">
        <h2 className="checklist__name">{list.name}</h2>
        <span className="checklist__count">{done}/{list.items.length}</span>
        <button
          type="button"
          className="checklist__delete"
          onClick={() => onDeleteList(list.id)}
          aria-label={t('checklists.deleteList')}
          title={t('checklists.deleteList')}
        >✕</button>
      </div>

      <ul className="checklist__items">
        {list.items.map(item => (
          <li key={item.id} className={`checklist__item${item.isChecked ? ' checklist__item--done' : ''}`}>
            <label className="checklist__label">
              <input
                type="checkbox"
                checked={item.isChecked}
                onChange={e => onToggle(list, item.id, e.target.checked, item.text)}
              />
              <span className="checklist__text">{item.text}</span>
            </label>
            <button
              type="button"
              className="checklist__item-delete"
              onClick={() => onDeleteItem(list.id, item.id)}
              aria-label={t('checklists.deleteItem')}
              title={t('checklists.deleteItem')}
            >✕</button>
          </li>
        ))}
      </ul>

      <form className="checklist__add" onSubmit={submitItem}>
        <input
          className="checklist__add-input"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={t('checklists.newItemPlaceholder')}
          maxLength={500}
        />
        <button type="submit" className="checklist__add-btn" disabled={!newItem.trim()}>
          {t('checklists.addItem')}
        </button>
      </form>
    </section>
  );
}
