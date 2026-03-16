import { formatRelativeTime } from '@/components/analysis-panel';

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-16T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "just now" for 0 seconds ago', () => {
    expect(formatRelativeTime('2026-03-16T12:00:00Z')).toBe('just now');
  });

  it('returns "just now" for 59 seconds ago', () => {
    expect(formatRelativeTime('2026-03-16T11:59:01Z')).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 60 seconds', () => {
    expect(formatRelativeTime('2026-03-16T11:59:00Z')).toBe('1 minute ago');
  });

  it('returns "59 minutes ago" for 59 minutes', () => {
    expect(formatRelativeTime('2026-03-16T11:01:00Z')).toBe('59 minutes ago');
  });

  it('returns "1 hour ago" for exactly 60 minutes', () => {
    expect(formatRelativeTime('2026-03-16T11:00:00Z')).toBe('1 hour ago');
  });

  it('returns "23 hours ago" for 23 hours', () => {
    expect(formatRelativeTime('2026-03-15T13:00:00Z')).toBe('23 hours ago');
  });

  it('returns "1 day ago" for exactly 24 hours', () => {
    expect(formatRelativeTime('2026-03-15T12:00:00Z')).toBe('1 day ago');
  });

  it('returns "6 days ago" for 6 days', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00Z')).toBe('6 days ago');
  });

  it('returns formatted date for 7+ days', () => {
    const result = formatRelativeTime('2026-03-09T12:00:00Z');
    expect(result).toMatch(/^on /);
  });

  it('returns null for future timestamps', () => {
    expect(formatRelativeTime('2026-03-17T00:00:00Z')).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatRelativeTime('')).toBeNull();
  });
});
