import { registerAs } from '@nestjs/config';

export const SCHEDULING_CONFIG_KEY = 'scheduling';

export interface SchedulingConfig {
  slotDurationMinutes: number;
  maxSlotsPerAppointment: number;
  openMinute: number; // minutes since midnight
  closeMinute: number;
  operatingDays: number[]; // 0 (Sun) - 6 (Sat)
  slotCapacity: number;
}

const toMinutes = (value: string, name: string): number => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new Error(`${name} must be in HH:mm format, got "${value}"`);
  return Number(m[1]) * 60 + Number(m[2]);
};

const toInt = (value: string | undefined, fallback: number, name: string) => {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  return n;
};

/** Reads + validates scheduling settings from .env. App fails fast on bad config. */
export default registerAs(SCHEDULING_CONFIG_KEY, (): SchedulingConfig => {
  const env = process.env;
  const slotDurationMinutes = toInt(env.SLOT_DURATION_MINUTES, 30, 'SLOT_DURATION_MINUTES');
  const maxSlotsPerAppointment = toInt(env.MAX_SLOTS_PER_APPOINTMENT, 5, 'MAX_SLOTS_PER_APPOINTMENT');
  const slotCapacity = toInt(env.SLOT_CAPACITY, 1, 'SLOT_CAPACITY');
  const openMinute = toMinutes(env.OPERATING_START ?? '09:00', 'OPERATING_START');
  const closeMinute = toMinutes(env.OPERATING_END ?? '18:00', 'OPERATING_END');
  const operatingDays = (env.OPERATING_DAYS ?? '1,2,3,4,5')
    .split(',')
    .map((d) => Number(d.trim()));

  if (slotDurationMinutes < 5) throw new Error('SLOT_DURATION_MINUTES must be >= 5');
  if (maxSlotsPerAppointment < 1 || maxSlotsPerAppointment > 5)
    throw new Error('MAX_SLOTS_PER_APPOINTMENT must be between 1 and 5');
  if (slotCapacity < 1) throw new Error('SLOT_CAPACITY must be >= 1');
  if (closeMinute - openMinute < slotDurationMinutes)
    throw new Error('Operating hours must fit at least one slot');
  if (!operatingDays.length || operatingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    throw new Error('OPERATING_DAYS must be a comma list of 0-6 (Sun-Sat)');

  return { slotDurationMinutes, maxSlotsPerAppointment, openMinute, closeMinute, operatingDays, slotCapacity };
});
