import { Priority, GoalPeriod } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function getPriorityOrder(priority: Priority): number {
  const order: Record<Priority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority];
}

function getDaysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round((d2.getTime() - d1.getTime()) / oneDay);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date, weekStartsOn: number = 1): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : weekStartsOn - day);
  const result = new Date(d.setDate(diff));
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date, weekStartsOn: number = 1): Date {
  const start = startOfWeek(date, weekStartsOn);
  const result = new Date(start);
  result.setDate(start.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getPeriodDates(period: GoalPeriod, referenceDate: Date = new Date()): { start: Date; end: Date } {
  const date = new Date(referenceDate);

  switch (period) {
    case 'daily':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'weekly':
      return { start: startOfWeek(date), end: endOfWeek(date) };
    case 'monthly': {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'quarterly': {
      const quarter = Math.floor(date.getMonth() / 3);
      const start = new Date(date.getFullYear(), quarter * 3, 1);
      const end = new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'yearly': {
      const start = new Date(date.getFullYear(), 0, 1);
      const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}

function calculateExpectedProgress(startDate: Date, targetDate: Date, now: Date = new Date()): number {
  const totalDuration = getDaysBetween(startDate, targetDate);
  const elapsed = getDaysBetween(startDate, now);

  if (totalDuration <= 0) {
    return 100;
  }

  if (elapsed <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((elapsed / totalDuration) * 100));
}

function calculateProgressWeighted(items: Array<{ progress: number; weight?: number }>): number {
  if (items.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let weightedProgress = 0;

  items.forEach(item => {
    const weight = item.weight ?? 1;
    totalWeight += weight;
    weightedProgress += item.progress * weight;
  });

  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
}

function isSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;

  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return false;
  return intersection.size / union.size >= threshold;
}

function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export {
  generateId,
  getPriorityOrder,
  getDaysBetween,
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  getPeriodDates,
  calculateExpectedProgress,
  calculateProgressWeighted,
  isSimilar,
  formatDate,
  clamp,
};
