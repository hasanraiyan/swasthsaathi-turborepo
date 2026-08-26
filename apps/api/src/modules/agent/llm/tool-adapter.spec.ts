import { toToolName, fromToolName } from './tool-adapter';

/**
 * Unit tests for the tool name adapter.
 *
 * OpenAI rejects `.` in function names, and nothing validates this
 * client-side — a bad mapping fails at the API mid-conversation. The dot
 * becomes a double underscore, and no capability name contains `__`, so the
 * mapping back is unambiguous.
 */

describe('toToolName', () => {
  it('converts dotted capability name to tool name', () => {
    expect(toToolName('medicines.create')).toBe('medicines__create');
  });

  it('converts nested domain names', () => {
    expect(toToolName('medicationSchedules.create')).toBe(
      'medicationSchedules__create',
    );
  });

  it('converts medicationDoses.day', () => {
    expect(toToolName('medicationDoses.day')).toBe('medicationDoses__day');
  });

  it('leaves non-dotted names unchanged', () => {
    expect(toToolName('profile')).toBe('profile');
  });
});

describe('fromToolName', () => {
  it('converts tool name back to capability name', () => {
    expect(fromToolName('medicines__create')).toBe('medicines.create');
  });

  it('converts nested names back', () => {
    expect(fromToolName('medicationSchedules__create')).toBe(
      'medicationSchedules.create',
    );
  });

  it('leaves non-underscored names unchanged', () => {
    expect(fromToolName('profile')).toBe('profile');
  });
});

describe('round-trip', () => {
  // Every registered capability name must survive toToolName → fromToolName
  const ALL_CAPABILITY_NAMES = [
    'profile.get',
    'profile.update',
    'prevention.snapshot',
    'prevention.plan',
    'prevention.complete',
    'prevention.history',
    'conditions.list',
    'conditions.get',
    'conditions.create',
    'conditions.update',
    'conditions.delete',
    'doctors.list',
    'doctors.get',
    'doctors.create',
    'doctors.update',
    'doctors.delete',
    'medicines.list',
    'medicines.get',
    'medicines.create',
    'medicines.update',
    'medicines.stop',
    'medicines.delete',
    'medicationSchedules.list',
    'medicationSchedules.create',
    'medicationSchedules.update',
    'medicationSchedules.delete',
    'medicationDoses.day',
    'medicationDoses.record',
    'medicationDoses.adherence',
    'medicationDoses.list',
    'appointments.list',
    'appointments.get',
    'appointments.create',
    'appointments.update',
    'appointments.delete',
    'symptoms.list',
    'symptoms.get',
    'symptoms.log',
    'symptoms.update',
    'symptoms.delete',
    'measurements.list',
    'measurements.record',
    'measurements.update',
    'measurements.delete',
    'measurements.trend',
    'documents.list',
    'documents.get',
    'documents.create',
    'documents.update',
    'documents.delete',
    'memory.list',
    'memory.write',
    'memory.delete',
  ];

  for (const name of ALL_CAPABILITY_NAMES) {
    it(`round-trips "${name}"`, () => {
      const toolName = toToolName(name);
      // Tool names must not contain dots (OpenAI requirement)
      expect(toolName).not.toContain('.');
      // Round-trip
      expect(fromToolName(toolName)).toBe(name);
    });
  }

  it('produces unique tool names for all capabilities', () => {
    const toolNames = ALL_CAPABILITY_NAMES.map(toToolName);
    const unique = new Set(toolNames);
    expect(unique.size).toBe(toolNames.length);
  });
});
