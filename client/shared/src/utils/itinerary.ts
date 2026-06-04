export function formatActivityTime(time: string | null | undefined): string {
  if (!time) return '';
  return time.substring(0, 5); // HH:mm:ss → HH:mm
}

export function getDaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}
