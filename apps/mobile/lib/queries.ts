import { useAuth } from '@clerk/expo';
import type {
  Appointment,
  CompleteCheckInput,
  Condition,
  HealthSnapshot,
  PreventivePlan,
  CreateAppointmentInput,
  CreateConditionInput,
  CreateDoctorInput,
  CreateMeasurementInput,
  CreateMedicationScheduleInput,
  CreateMedicineInput,
  CreateSymptomEntryInput,
  DaySchedule,
  Doctor,
  ListResult,
  Measurement,
  Medicine,
  MedicineWithSchedules,
  Profile,
  StopMedicineInput,
  SymptomEntry,
  UpdateProfileInput,
} from '@repo/contracts';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { createApiClient, type ApiClient } from './api';

/** The API client, bound to the signed-in user's Clerk token. */
export function useApi(): ApiClient {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient(() => getToken()), [getToken]);
}

/**
 * Query keys.
 *
 * Grouped by domain so a write can invalidate everything it touched with one
 * prefix -- recording a dose changes both the day view and the adherence
 * summary, and forgetting the second is the kind of bug that shows a user
 * stale progress.
 */
export const keys = {
  profile: ['profile'] as const,
  prevention: ['prevention'] as const,
  conditions: ['conditions'] as const,
  doctors: ['doctors'] as const,
  medicines: ['medicines'] as const,
  medicine: (id: string) => ['medicines', id] as const,
  doses: ['doses'] as const,
  day: (date?: string) => ['doses', 'day', date ?? 'today'] as const,
  adherence: ['doses', 'adherence'] as const,
  appointments: ['appointments'] as const,
  symptoms: ['symptoms'] as const,
  measurements: ['measurements'] as const,
};

// --- profile -------------------------------------------------------------

export function useProfile(): UseQueryResult<Profile> {
  const api = useApi();
  return useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile>('/profile') });
}

export function useUpdateProfile(): UseMutationResult<Profile, Error, UpdateProfileInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<Profile>('/profile', input),
    onSuccess: (profile) => {
      client.setQueryData(keys.profile, profile);
      // The preventive plan is derived from the baseline, so editing height,
      // habits or family history changes which checks apply.
      void client.invalidateQueries({ queryKey: keys.prevention });
    },
  });
}

// --- prevention ----------------------------------------------------------

export function usePreventivePlan(): UseQueryResult<PreventivePlan> {
  const api = useApi();
  return useQuery({
    queryKey: [...keys.prevention, 'plan'],
    queryFn: () => api.get<PreventivePlan>('/prevention/plan'),
  });
}

export function useHealthSnapshot(): UseQueryResult<HealthSnapshot> {
  const api = useApi();
  return useQuery({
    queryKey: [...keys.prevention, 'snapshot'],
    queryFn: () => api.get<HealthSnapshot>('/prevention/snapshot'),
  });
}

export function useCompleteCheck(): UseMutationResult<unknown, Error, CompleteCheckInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteCheckInput) => api.post('/prevention/complete', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.prevention }),
  });
}

// --- today ---------------------------------------------------------------

export function useDay(date?: string): UseQueryResult<DaySchedule> {
  const api = useApi();
  return useQuery({
    queryKey: keys.day(date),
    queryFn: () => api.get<DaySchedule>('/medication-doses/day', { date }),
  });
}

export function useRecordDose(): UseMutationResult<
  unknown,
  Error,
  { doseId: string; status: 'taken' | 'skipped' }
> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ doseId, status }: { doseId: string; status: 'taken' | 'skipped' }) =>
      api.post(`/medication-doses/${doseId}/record`, { status }),
    // Both the day list and the adherence summary derive from this row.
    onSuccess: () => client.invalidateQueries({ queryKey: keys.doses }),
  });
}

// --- medicines -----------------------------------------------------------

export function useMedicines(status?: string): UseQueryResult<ListResult<Medicine>> {
  const api = useApi();
  return useQuery({
    queryKey: [...keys.medicines, status ?? 'all'],
    queryFn: () => api.get<ListResult<Medicine>>('/medicines', { status }),
  });
}

export function useMedicine(id: string): UseQueryResult<MedicineWithSchedules> {
  const api = useApi();
  return useQuery({
    queryKey: keys.medicine(id),
    queryFn: () => api.get<MedicineWithSchedules>(`/medicines/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateMedicine(): UseMutationResult<Medicine, Error, CreateMedicineInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicineInput) => api.post<Medicine>('/medicines', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.medicines }),
  });
}

export function useStopMedicine(): UseMutationResult<Medicine, Error, StopMedicineInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: StopMedicineInput) =>
      api.post<Medicine>(`/medicines/${id}/stop`, body),
    onSuccess: () => {
      // Stopping cancels future doses, so today's list changes too.
      void client.invalidateQueries({ queryKey: keys.medicines });
      void client.invalidateQueries({ queryKey: keys.doses });
    },
  });
}

export function useCreateSchedule(): UseMutationResult<
  unknown,
  Error,
  CreateMedicationScheduleInput
> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicationScheduleInput) =>
      api.post('/medication-schedules', input),
    onSuccess: (_result, input) => {
      void client.invalidateQueries({ queryKey: keys.medicine(input.medicineId) });
      void client.invalidateQueries({ queryKey: keys.doses });
    },
  });
}

// --- conditions ----------------------------------------------------------

export function useConditions(): UseQueryResult<ListResult<Condition>> {
  const api = useApi();
  return useQuery({
    queryKey: keys.conditions,
    queryFn: () => api.get<ListResult<Condition>>('/conditions'),
  });
}

export function useCreateCondition(): UseMutationResult<Condition, Error, CreateConditionInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConditionInput) => api.post<Condition>('/conditions', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.conditions });
      // A new condition can add checks of its own -- diabetes brings a yearly
      // eye examination and a tighter blood-sugar interval.
      void client.invalidateQueries({ queryKey: keys.prevention });
    },
  });
}

// --- doctors -------------------------------------------------------------

export function useDoctors(): UseQueryResult<ListResult<Doctor>> {
  const api = useApi();
  return useQuery({
    queryKey: keys.doctors,
    queryFn: () => api.get<ListResult<Doctor>>('/doctors'),
  });
}

export function useCreateDoctor(): UseMutationResult<Doctor, Error, CreateDoctorInput> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDoctorInput) => api.post<Doctor>('/doctors', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.doctors }),
  });
}

// --- appointments --------------------------------------------------------

export function useAppointments(upcomingOnly?: boolean): UseQueryResult<ListResult<Appointment>> {
  const api = useApi();
  return useQuery({
    queryKey: [...keys.appointments, upcomingOnly ?? false],
    queryFn: () => api.get<ListResult<Appointment>>('/appointments', { upcomingOnly }),
  });
}

export function useCreateAppointment(): UseMutationResult<
  Appointment,
  Error,
  CreateAppointmentInput
> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => api.post<Appointment>('/appointments', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.appointments }),
  });
}

// --- symptoms ------------------------------------------------------------

export function useSymptoms(): UseQueryResult<ListResult<SymptomEntry>> {
  const api = useApi();
  return useQuery({
    queryKey: keys.symptoms,
    queryFn: () => api.get<ListResult<SymptomEntry>>('/symptoms'),
  });
}

export function useLogSymptom(): UseMutationResult<
  SymptomEntry,
  Error,
  CreateSymptomEntryInput
> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSymptomEntryInput) => api.post<SymptomEntry>('/symptoms', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.symptoms }),
  });
}

// --- measurements --------------------------------------------------------

export function useMeasurements(): UseQueryResult<ListResult<Measurement>> {
  const api = useApi();
  return useQuery({
    queryKey: keys.measurements,
    queryFn: () => api.get<ListResult<Measurement>>('/measurements'),
  });
}

export function useRecordMeasurement(): UseMutationResult<
  Measurement,
  Error,
  CreateMeasurementInput
> {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMeasurementInput) => api.post<Measurement>('/measurements', input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.measurements }),
  });
}
