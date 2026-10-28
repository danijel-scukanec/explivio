import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripMember, TripRole } from '@explivio/shared';
import {
  getTripMembers,
  getMemberRole,
  inviteMember,
  setMemberRole,
  removeMember,
} from '../services/tripsApi';
import './MembersModal.css';

const ROLES: TripRole[] = ['Owner', 'Editor', 'Viewer'];

interface Props {
  tripId: string;
  onClose: () => void;
}

// F15: manage who can see/edit a trip. Owners can invite people by email, change roles, and remove
// members (the API enforces the same, plus the last-owner guard); everyone else sees a read-only list.
export function MembersModal({ tripId, onClose }: Props) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [callerRole, setCallerRole] = useState<TripRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TripRole>('Editor');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, r] = await Promise.all([getTripMembers(tripId), getMemberRole(tripId)]);
      setMembers(m);
      setCallerRole(r);
    } catch {
      setError(t('members.loadError'));
    } finally {
      setLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => { void load(); }, [load]);

  const isOwner = callerRole === 'Owner';
  const roleLabel = (role: TripRole) => t(`members.role${role}`);

  async function run(action: () => Promise<unknown>, fallbackKey: string) {
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

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email || busy) return;
    await run(async () => {
      await inviteMember(tripId, email, inviteRole);
      setInviteEmail('');
    }, 'members.inviteError');
  }

  return (
    <div className="members-modal__backdrop" onClick={onClose}>
      <div className="members-modal" onClick={e => e.stopPropagation()}>
        <div className="members-modal__head">
          <h2>{t('members.title')}</h2>
          <button className="members-modal__close" onClick={onClose} aria-label={t('members.close')}>×</button>
        </div>

        {error && <p className="members-modal__error">{error}</p>}

        {loading ? (
          <p className="members-modal__muted">{t('members.loading')}</p>
        ) : (
          <ul className="members-modal__list">
            {members.map(m => (
              <li key={m.userId} className="members-modal__row">
                <div className="members-modal__person">
                  <span className="members-modal__name">
                    {m.displayName || m.email || m.userId.slice(0, 8)}
                  </span>
                  {m.email && <span className="members-modal__email">{m.email}</span>}
                </div>
                {isOwner ? (
                  <div className="members-modal__controls">
                    <select
                      value={m.role}
                      disabled={busy}
                      onChange={e => run(() => setMemberRole(tripId, m.userId, e.target.value as TripRole), 'members.roleError')}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                    <button
                      className="members-modal__remove"
                      disabled={busy}
                      onClick={() => run(() => removeMember(tripId, m.userId), 'members.removeError')}
                    >
                      {t('members.remove')}
                    </button>
                  </div>
                ) : (
                  <span className="members-modal__role">{roleLabel(m.role)}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <form className="members-modal__invite" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder={t('members.emailPlaceholder')}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as TripRole)}>
              {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button type="submit" className="btn btn--primary" disabled={busy || !inviteEmail.trim()}>
              {t('members.invite')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
