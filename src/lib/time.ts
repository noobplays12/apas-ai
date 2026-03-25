import type { IsoTimestamp } from '../types';

export function toIso(date: Date): IsoTimestamp {
  return date.toISOString();
}

export function toDate(ts: IsoTimestamp | Date | number | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

export function toMillis(ts: IsoTimestamp | Date | number | null | undefined): number {
  const d = toDate(ts);
  return d ? d.getTime() : 0;
}

