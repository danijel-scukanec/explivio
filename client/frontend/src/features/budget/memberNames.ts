import type { TripMember } from '@explivio/shared';

// F25: a readable name for a trip member. Falls back to a short id when the member has no display
// name yet (e.g. the fake dev user before a Users row exists).
export function memberName(member: Pick<TripMember, 'userId' | 'displayName'>): string {
  return member.displayName?.trim() || `User ${member.userId.slice(0, 4)}`;
}

export function nameFor(members: TripMember[], userId: string | null | undefined): string {
  if (!userId) return '—';
  const member = members.find(m => m.userId === userId);
  return member ? memberName(member) : `User ${userId.slice(0, 4)}`;
}
