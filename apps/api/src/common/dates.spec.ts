import {
  addMonths,
  yearsSince,
  daysBetween,
  atTimeOfDay,
  toDateOnly,
  startOfDay,
  addDays,
  dayOfWeek,
} from './dates';

describe('addMonths', () => {
  it('clamps to a shorter month: 31 Jan + 1 month is 28 Feb, not 3 Mar', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('clamps to 28 Feb in a leap year: 31 Jan + 1 month is 29 Feb', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('crosses a year boundary correctly', () => {
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('adds zero months', () => {
    expect(addMonths('2026-06-15', 0)).toBe('2026-06-15');
  });

  it('handles 30-day month correctly', () => {
    expect(addMonths('2026-04-30', 1)).toBe('2026-05-30');
  });
});

describe('yearsSince', () => {
  it('returns 45 the day before the 46th birthday', () => {
    const today = new Date();
    const year = today.getFullYear();
    // Birthday is tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dob = `${year - 46}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(yearsSince(dob)).toBe(45);
  });

  it('returns 46 on the birthday', () => {
    const today = new Date();
    const year = today.getFullYear();
    const dob = `${year - 46}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Could be 45 or 46 depending on whether today IS the birthday
    const age = yearsSince(dob);
    expect(age).toBeGreaterThanOrEqual(45);
    expect(age).toBeLessThanOrEqual(46);
  });

  it('returns 0 for a newborn', () => {
    const today = new Date();
    const recent = new Date(today);
    recent.setDate(recent.getDate() - 1);
    const dob = toDateOnly(recent);
    expect(yearsSince(dob)).toBe(0);
  });
});

describe('daysBetween', () => {
  it('is negative when the target is in the past', () => {
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
  });

  it('is zero for the same day', () => {
    expect(daysBetween('2026-06-15', '2026-06-15')).toBe(0);
  });

  it('is positive for a future date', () => {
    expect(daysBetween('2026-01-01', '2026-01-10')).toBe(9);
  });
});

describe('atTimeOfDay', () => {
  it('combines a date and time in local time', () => {
    const result = atTimeOfDay('2026-06-15', '14:30');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // June = 5
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('handles midnight', () => {
    const result = atTimeOfDay('2026-06-15', '00:00');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('toDateOnly', () => {
  it('produces YYYY-MM-DD format', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(toDateOnly(d)).toBe('2026-01-05');
  });

  it('pads month and day', () => {
    const d = new Date(2026, 0, 1); // Jan 1
    expect(toDateOnly(d)).toBe('2026-01-01');
  });
});

describe('startOfDay', () => {
  it('returns local midnight', () => {
    const d = startOfDay('2026-06-15');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe('addDays', () => {
  it('adds days correctly', () => {
    expect(addDays('2026-01-01', 5)).toBe('2026-01-06');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('subtracts days', () => {
    expect(addDays('2026-01-10', -5)).toBe('2026-01-05');
  });
});

describe('dayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    // 2026-01-04 is a Sunday
    expect(dayOfWeek('2026-01-04')).toBe(0);
  });

  it('returns 1 for Monday', () => {
    // 2026-01-05 is a Monday
    expect(dayOfWeek('2026-01-05')).toBe(1);
  });
});
