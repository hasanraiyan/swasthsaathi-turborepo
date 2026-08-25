/** Presentation helpers shared by screens and the chat's intent cards. */

/** `after_food` becomes "After food". */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "8:00 am" */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Tue 2 Sep, 10:30 am" */
export function dateAndTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "today", "yesterday", "3 days ago" -- how a person would say it. */
export function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) {
    return 'today';
  }
  if (days === 1) {
    return 'yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Whether an instant has already gone by. */
export function hasPassed(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/** "1 tablet", "2 tablets", "5 ml" -- units that aren't countable stay as-is. */
export function formatDose(amount: number, unit: string): string {
  const plural = amount === 1 || unit.endsWith('s') || unit === 'ml' ? unit : `${unit}s`;
  return `${amount} ${plural}`;
}
