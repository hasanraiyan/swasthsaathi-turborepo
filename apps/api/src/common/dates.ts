/**
 * Date helpers for the parts of the product where "which day is it" matters:
 * the daily medicine list and the adherence window.
 *
 * Calendar dates travel as `YYYY-MM-DD` strings and are stored that way, so
 * a course that starts on the 3rd starts on the 3rd regardless of where the
 * user is when they open the app.
 */

export const MS_PER_DAY = 86_400_000;

/** Today as `YYYY-MM-DD` in the server's local zone. */
export function today(): string {
  return toDateOnly(new Date());
}

export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` into local midnight. */
export function startOfDay(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

/** The instant immediately after the given day ends. */
export function endOfDayExclusive(dateOnly: string): Date {
  const start = startOfDay(dateOnly);
  return new Date(start.getTime() + MS_PER_DAY);
}

/** Combine a calendar date with an `HH:MM` wall-clock time. */
export function atTimeOfDay(dateOnly: string, timeOfDay: string): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const date = startOfDay(dateOnly);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

export function addDays(dateOnly: string, days: number): string {
  return toDateOnly(
    new Date(startOfDay(dateOnly).getTime() + days * MS_PER_DAY),
  );
}

/** Sunday = 0, matching `Date.prototype.getDay()`. */
export function dayOfWeek(dateOnly: string): number {
  return startOfDay(dateOnly).getDay();
}

/** Inclusive comparison on `YYYY-MM-DD` strings, which sort lexicographically. */
export function isWithin(
  dateOnly: string,
  from: string | null,
  to: string | null,
): boolean {
  if (from && dateOnly < from) {
    return false;
  }
  if (to && dateOnly > to) {
    return false;
  }
  return true;
}
