import type Feather from '@expo/vector-icons/Feather';
import type { MedicationDoseWithMedicine } from '@repo/contracts';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { dateAndTime, hasPassed, humanize, relativeDay } from './format';
import {
  useAppointments,
  useConditions,
  useDay,
  useDoctors,
  useMeasurements,
  useMedicines,
  useSymptoms,
} from './queries';

/**
 * The cards on an empty chat.
 *
 * These are not a feature tour. Each one is a piece of the user's actual
 * record with something to do about it -- the dose that is next due, the
 * appointment that is coming, the reading that was last taken. Where a part
 * of the record is genuinely empty, the card offers the real action that
 * fills it rather than describing what the section would contain.
 *
 * Everything here is read through the same query hooks the screens use, so a
 * card can never drift from what the rest of the app shows.
 */

export type IntentAction =
  | { kind: 'ask'; label: string; prompt: string }
  | { kind: 'open'; label: string; href: string };

/** A read of the record with one thing to do about it. */
export interface SummaryCard {
  kind: 'summary';
  key: string;
  icon: ComponentProps<typeof Feather>['name'];
  /** Which part of the record this came from. */
  section: string;
  /** The datum itself, set large. */
  headline: string;
  detail?: string;
  action: IntentAction;
  hasData: boolean;
}

/**
 * A dose that is actually due, carried whole into the chat.
 *
 * Not a summary of Today -- the row itself, with the same Taken and Skip it
 * has on the Today screen, so the most common action in the product can be
 * finished without leaving the conversation.
 */
export interface DoseCard {
  kind: 'dose';
  key: string;
  dose: MedicationDoseWithMedicine;
  /**
   * Whether the time has already gone by. Settled here, next to the data,
   * rather than in the card: reading the clock is not a render-time job.
   */
  due: boolean;
  hasData: true;
}

export type IntentCard = SummaryCard | DoseCard;

/** Enough to swipe through without becoming a list. */
const MAX_CARDS = 8;
/** Beyond a few, the Today screen is the better place to work through them. */
const MAX_DOSE_CARDS = 3;

export function useIntentCards(): {
  cards: IntentCard[];
  loading: boolean;
  unavailable: boolean;
  refetch: () => void;
} {
  const day = useDay();
  const medicines = useMedicines('active');
  const conditions = useConditions();
  const appointments = useAppointments(true);
  const doctors = useDoctors();
  const symptoms = useSymptoms();
  const measurements = useMeasurements();

  const queries = [day, medicines, conditions, appointments, doctors, symptoms, measurements];
  const loading = queries.some((query) => query.isPending);
  // Only claim the record is unreachable when nothing at all came back --
  // one failed query should not blank the whole deck.
  const unavailable = queries.every((query) => query.isError);

  const cards = useMemo(() => {
    // Doses lead the deck: they are the one thing here that is time-bound.
    const doseCards: DoseCard[] = [];
    const built: SummaryCard[] = [];

    // --- today's doses ---------------------------------------------------
    if (day.data && day.data.totalCount > 0) {
      const actionable = day.data.doses.filter(
        (dose) => dose.status === 'pending' || dose.status === 'missed',
      );

      for (const dose of actionable.slice(0, MAX_DOSE_CARDS)) {
        doseCards.push({
          kind: 'dose',
          key: `dose-${dose.id}`,
          dose,
          due: hasPassed(dose.scheduledFor),
          hasData: true,
        });
      }

      if (actionable.length > MAX_DOSE_CARDS) {
        built.push({
          kind: 'summary',
          key: 'today-more',
          icon: 'sun',
          section: 'Today',
          headline: `${actionable.length - MAX_DOSE_CARDS} more due`,
          detail: `${day.data.takenCount} of ${day.data.totalCount} taken so far`,
          action: { kind: 'open', label: 'Open Today', href: '/today' },
          hasData: true,
        });
      } else if (actionable.length === 0) {
        built.push({
          kind: 'summary',
          key: 'today-done',
          icon: 'sun',
          section: 'Today',
          headline: `All ${day.data.totalCount} doses done`,
          detail: `${day.data.takenCount} taken today`,
          action: {
            kind: 'ask',
            label: 'Ask about today',
            prompt: 'How have I done with my medicines today?',
          },
          hasData: true,
        });
      }
    }

    // --- medicines -------------------------------------------------------
    if (medicines.data) {
      const items = medicines.data.items;
      if (items.length > 0) {
        built.push({
          kind: 'summary',
          key: 'medicines',
          icon: 'thermometer',
          section: 'Medicines',
          headline: `${items.length} active ${items.length === 1 ? 'medicine' : 'medicines'}`,
          detail: items
            .slice(0, 3)
            .map((medicine) => medicine.name)
            .join(', '),
          action: {
            kind: 'ask',
            label: 'Ask about your medicines',
            prompt: 'What do I take in the morning?',
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'medicines-empty',
          icon: 'thermometer',
          section: 'Medicines',
          headline: 'No medicines yet',
          detail: 'Add what you take to see it on Today.',
          action: { kind: 'open', label: 'Add your first medicine', href: '/medicines/new' },
          hasData: false,
        });
      }
    }

    // --- appointments ----------------------------------------------------
    if (appointments.data) {
      const next = appointments.data.items[0];
      if (next) {
        built.push({
          kind: 'summary',
          key: 'appointment',
          icon: 'calendar',
          section: 'Next appointment',
          headline: next.title,
          detail: [dateAndTime(next.scheduledFor), next.location].filter(Boolean).join(' · '),
          action: {
            kind: 'ask',
            label: 'Prepare for this visit',
            prompt: `What should I bring to ${next.title}?`,
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'appointment-empty',
          icon: 'calendar',
          section: 'Appointments',
          headline: 'Nothing coming up',
          detail: 'Add a visit and note what the doctor said afterwards.',
          action: { kind: 'open', label: 'Add an appointment', href: '/appointments' },
          hasData: false,
        });
      }
    }

    // --- conditions ------------------------------------------------------
    if (conditions.data) {
      const active =
        conditions.data.items.find((condition) => condition.status === 'active') ??
        conditions.data.items[0];
      if (active) {
        built.push({
          kind: 'summary',
          key: 'condition',
          icon: 'activity',
          section: 'Condition',
          headline: active.name,
          detail: [
            humanize(active.status),
            active.severity ? humanize(active.severity) : null,
            active.diagnosedOn ? `since ${active.diagnosedOn}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          action: {
            kind: 'ask',
            label: 'Ask about this',
            prompt: `What am I taking for ${active.name}?`,
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'condition-empty',
          icon: 'activity',
          section: 'Conditions',
          headline: 'No conditions recorded',
          detail: 'Recording one links your medicines and symptoms to it.',
          action: { kind: 'open', label: 'Add a condition', href: '/conditions' },
          hasData: false,
        });
      }
    }

    // --- readings --------------------------------------------------------
    if (measurements.data) {
      const latest = measurements.data.items[0];
      if (latest) {
        const reading =
          latest.valueSecondary !== null
            ? `${latest.value}/${latest.valueSecondary}`
            : `${latest.value}`;
        built.push({
          kind: 'summary',
          key: 'reading',
          icon: 'trending-up',
          section: humanize(latest.type),
          headline: `${reading} ${latest.unit}`,
          detail: `Taken ${relativeDay(latest.measuredAt)}`,
          action: {
            kind: 'ask',
            label: 'Ask about the trend',
            prompt: `How has my ${humanize(latest.type).toLowerCase()} been?`,
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'reading-empty',
          icon: 'trending-up',
          section: 'Readings',
          headline: 'No readings yet',
          detail: 'Blood pressure, sugar, weight — the trend builds itself.',
          action: { kind: 'open', label: 'Record a reading', href: '/measurements' },
          hasData: false,
        });
      }
    }

    // --- symptoms --------------------------------------------------------
    if (symptoms.data) {
      const latest = symptoms.data.items[0];
      if (latest) {
        built.push({
          kind: 'summary',
          key: 'symptom',
          icon: 'alert-circle',
          section: 'Last symptom',
          headline: `${latest.name} · ${latest.severity}/10`,
          detail: `Logged ${relativeDay(latest.startedAt)}${latest.endedAt ? '' : ' · still going'}`,
          action: {
            kind: 'ask',
            label: 'Look for a pattern',
            prompt: `How often have I had ${latest.name.toLowerCase()}?`,
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'symptom-empty',
          icon: 'alert-circle',
          section: 'Symptoms',
          headline: 'Nothing logged yet',
          detail: 'Logging how you feel shows a pattern over time.',
          action: { kind: 'open', label: 'Log a symptom', href: '/symptoms' },
          hasData: false,
        });
      }
    }

    // --- doctors ---------------------------------------------------------
    if (doctors.data) {
      const doctor = doctors.data.items[0];
      if (doctor) {
        built.push({
          kind: 'summary',
          key: 'doctor',
          icon: 'users',
          section: 'Your doctor',
          headline: doctor.name,
          detail: [doctor.specialty, doctor.hospital].filter(Boolean).join(' · ') || undefined,
          action: {
            kind: 'ask',
            label: 'Ask about their advice',
            prompt: `What did ${doctor.name} last tell me?`,
          },
          hasData: true,
        });
      } else {
        built.push({
          kind: 'summary',
          key: 'doctor-empty',
          icon: 'users',
          section: 'Doctors',
          headline: 'No doctors saved',
          detail: 'Save who you see so visits and prescriptions point at them.',
          action: { kind: 'open', label: 'Add a doctor', href: '/doctors' },
          hasData: false,
        });
      }
    }

    // What the user actually has comes first; the prompts to fill gaps follow.
    const rest = [...built].sort((a, b) => Number(b.hasData) - Number(a.hasData));
    return [...doseCards, ...rest].slice(0, MAX_CARDS);
  }, [
    day.data,
    medicines.data,
    conditions.data,
    appointments.data,
    doctors.data,
    symptoms.data,
    measurements.data,
  ]);

  return {
    cards,
    loading,
    unavailable,
    refetch: () => {
      for (const query of queries) {
        void query.refetch();
      }
    },
  };
}
