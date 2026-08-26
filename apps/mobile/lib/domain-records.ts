import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { clockTime, dateAndTime, formatDose, humanize, relativeDay } from './format';

/**
 * Turning one of this app's own records into something a trace row can show.
 *
 * Every domain here already has an icon and a way of describing itself --
 * `lib/intent-cards.ts` decided all of that for the empty-chat cards. Reusing
 * it is what makes a tool trace look like part of the app rather than a
 * debugging pane bolted onto it.
 */

type Tone = 'taken' | 'pending' | 'missed' | 'skipped';

export interface RecordSummary {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string | null;
  status: { label: string; tone: Tone } | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

const TONE_BY_STATUS: Record<string, Tone> = {
  active: 'taken',
  completed: 'taken',
  up_to_date: 'taken',
  taken: 'taken',
  scheduled: 'taken',
  monitoring: 'pending',
  due_soon: 'pending',
  due: 'pending',
  pending: 'pending',
  paused: 'pending',
  overdue: 'missed',
  missed: 'missed',
  severe: 'missed',
  stopped: 'missed',
  cancelled: 'missed',
  resolved: 'skipped',
  skipped: 'skipped',
  mild: 'skipped',
  moderate: 'pending',
};

/** A status string this app hasn't seen before reads as neutral, not alarming. */
export function toneFor(status: string): Tone {
  return TONE_BY_STATUS[status] ?? 'skipped';
}

function statusOf(raw: unknown): RecordSummary['status'] {
  const value = str(raw);
  return value ? { label: humanize(value), tone: toneFor(value) } : null;
}

function medicine(r: Record<string, unknown>): RecordSummary {
  const form = str(r.form);
  return {
    icon: 'thermometer',
    title: str(r.name) ?? 'Medicine',
    subtitle: [form ? humanize(form) : null, str(r.strength)].filter(Boolean).join(' · ') || null,
    status: statusOf(r.status),
  };
}

function appointment(r: Record<string, unknown>): RecordSummary {
  const scheduledFor = str(r.scheduledFor);
  return {
    icon: 'calendar',
    title: str(r.title) ?? 'Appointment',
    subtitle: [scheduledFor ? dateAndTime(scheduledFor) : null, str(r.location)].filter(Boolean).join(' · ') || null,
    status: statusOf(r.status),
  };
}

function condition(r: Record<string, unknown>): RecordSummary {
  const severity = str(r.severity);
  const diagnosedOn = str(r.diagnosedOn);
  return {
    icon: 'activity',
    title: str(r.name) ?? 'Condition',
    subtitle:
      [severity ? humanize(severity) : null, diagnosedOn ? `since ${diagnosedOn}` : null].filter(Boolean).join(' · ') ||
      null,
    status: statusOf(r.status),
  };
}

function doctor(r: Record<string, unknown>): RecordSummary {
  return {
    icon: 'users',
    title: str(r.name) ?? 'Doctor',
    subtitle: [str(r.specialty), str(r.hospital)].filter(Boolean).join(' · ') || null,
    status: null,
  };
}

function symptomEntry(r: Record<string, unknown>): RecordSummary {
  const severity = num(r.severity);
  const startedAt = str(r.startedAt);
  const ongoing = startedAt && !str(r.endedAt);
  return {
    icon: 'alert-circle',
    title: str(r.name) ?? 'Symptom',
    subtitle:
      [severity !== null ? `${severity}/10` : null, startedAt ? relativeDay(startedAt) : null, ongoing ? 'ongoing' : null]
        .filter(Boolean)
        .join(' · ') || null,
    status: null,
  };
}

function document(r: Record<string, unknown>): RecordSummary {
  const kind = str(r.kind);
  return {
    icon: 'folder',
    title: str(r.title) ?? 'Document',
    subtitle: [kind ? humanize(kind) : null, str(r.documentDate)].filter(Boolean).join(' · ') || null,
    status: null,
  };
}

function measurement(r: Record<string, unknown>): RecordSummary {
  const value = num(r.value);
  const secondary = num(r.valueSecondary);
  const unit = str(r.unit);
  const type = str(r.type);
  const reading = value !== null ? (secondary !== null ? `${value}/${secondary}` : `${value}`) : null;
  const measuredAt = str(r.measuredAt);
  return {
    icon: 'trending-up',
    title: type ? humanize(type) : 'Reading',
    subtitle:
      [reading ? `${reading}${unit ? ` ${unit}` : ''}` : null, measuredAt ? relativeDay(measuredAt) : null]
        .filter(Boolean)
        .join(' · ') || null,
    status: null,
  };
}

function schedule(r: Record<string, unknown>): RecordSummary {
  const doseAmount = num(r.doseAmount);
  const doseUnit = str(r.doseUnit);
  const active = r.active;
  return {
    icon: 'thermometer',
    title: doseAmount !== null && doseUnit ? formatDose(doseAmount, doseUnit) : 'Schedule',
    subtitle: str(r.timing) ? humanize(str(r.timing)!) : null,
    status: typeof active === 'boolean' ? { label: active ? 'Active' : 'Inactive', tone: active ? 'taken' : 'skipped' } : null,
  };
}

function dose(r: Record<string, unknown>): RecordSummary {
  const scheduledFor = str(r.scheduledFor);
  return {
    icon: 'thermometer',
    title: str(r.medicineName) ?? 'Dose',
    subtitle: scheduledFor ? clockTime(scheduledFor) : null,
    status: statusOf(r.status),
  };
}

function memoryEntry(r: Record<string, unknown>): RecordSummary {
  const content = str(r.content) ?? '';
  return {
    icon: 'bookmark',
    title: str(r.key) ?? 'Memory',
    subtitle: content.length > 80 ? `${content.slice(0, 80)}…` : content || null,
    status: null,
  };
}

function checkLog(r: Record<string, unknown>): RecordSummary {
  const checkKey = str(r.checkKey);
  return {
    icon: 'shield',
    title: checkKey ? humanize(checkKey) : 'Check',
    subtitle: [str(r.completedOn), str(r.note)].filter(Boolean).join(' · ') || null,
    status: { label: 'Completed', tone: 'taken' },
  };
}

const SUMMARIZERS: Record<string, (record: Record<string, unknown>) => RecordSummary> = {
  medicines: medicine,
  appointments: appointment,
  conditions: condition,
  doctors: doctor,
  symptoms: symptomEntry,
  documents: document,
  measurements: measurement,
  medicationSchedules: schedule,
  medicationDoses: dose,
  memory: memoryEntry,
  prevention: checkLog,
};

/** The record renderer for a capability's domain, if this app knows the shape. */
export function summarizerFor(toolName: string): ((record: Record<string, unknown>) => RecordSummary) | null {
  const domain = toolName.split('.')[0] ?? '';
  return SUMMARIZERS[domain] ?? null;
}
