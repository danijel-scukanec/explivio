import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TripMember, TripRole, TripInvite } from '@explivio/shared';
import {
  getTripMembers,
  getMemberRole,
  getTripInvites,
  inviteMember,
  cancelInvite,
  setMemberRole,
  removeMember,
} from '../services/tripsApi';
import { useConfirm } from '../../../shared/components/ConfirmProvider';
import { Modal, ModalBody } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const ROLES: TripRole[] = ['Owner', 'Editor', 'Viewer'];

interface Props {
  tripId: string;
  onClose: () => void;
}

// F15: manage who can see/edit a trip. Owners can invite people by email, change roles, and remove
// members (the API enforces the same, plus the last-owner guard); everyone else sees a read-only list.
export function MembersModal({ tripId, onClose }: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [invites, setInvites] = useState<TripInvite[]>([]);
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
      // Pending invites are Owner-only; skip the call for everyone else.
      setInvites(r === 'Owner' ? await getTripInvites(tripId) : []);
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

  const row = 'flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0';
  const name = 'text-card-foreground text-sm font-medium';
  const sub = 'text-muted-foreground text-xs';

  return (
    <Modal title={t('members.title')} onClose={onClose}>
      <ModalBody>
        {error && <p className="text-destructive text-sm">{error}</p>}

        {loading ? (
          <p className="text-muted-foreground text-sm">{t('members.loading')}</p>
        ) : (
          <ul className="flex flex-col">
            {members.map(m => (
              <li key={m.userId} className={row}>
                <div className="flex min-w-0 flex-col">
                  <span className={name}>{m.displayName || m.email || m.userId.slice(0, 8)}</span>
                  {m.email && <span className={sub}>{m.email}</span>}
                </div>
                {isOwner ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      className="h-8 w-auto"
                      value={m.role}
                      disabled={busy}
                      onChange={e => run(() => setMemberRole(tripId, m.userId, e.target.value as TripRole), 'members.roleError')}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={async () => { if (await confirm()) run(() => removeMember(tripId, m.userId), 'members.removeError'); }}
                    >
                      {t('members.remove')}
                    </Button>
                  </div>
                ) : (
                  <span className={sub}>{roleLabel(m.role)}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner && invites.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{t('members.pending')}</h3>
            <ul className="flex flex-col">
              {invites.map(inv => (
                <li key={inv.id} className={row}>
                  <div className="flex min-w-0 flex-col">
                    <span className={name}>{inv.email}</span>
                    <span className={sub}>{roleLabel(inv.role)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => run(() => cancelInvite(tripId, inv.id), 'members.cancelError')}
                  >
                    {t('members.cancel')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isOwner && (
          <form className="flex items-center gap-2 pt-1" onSubmit={handleInvite}>
            <Input
              type="email"
              className="flex-1"
              placeholder={t('members.emailPlaceholder')}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
            <Select className="w-auto" value={inviteRole} onChange={e => setInviteRole(e.target.value as TripRole)}>
              {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </Select>
            <Button type="submit" disabled={busy || !inviteEmail.trim()}>{t('members.invite')}</Button>
          </form>
        )}
      </ModalBody>
    </Modal>
  );
}
