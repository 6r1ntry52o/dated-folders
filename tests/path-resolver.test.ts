import { describe, expect, it } from 'vitest';
import { datedSegments, effectiveWeekStart, isoWeek, msUntilNextMidnight, resolveDatedPath, weekStartOf, type Grain, type WeekStart } from '../src/path-resolver';

const d = (y: number, m: number, day: number, h = 12): Date => new Date(y, m - 1, day, h, 0, 0);

describe('resolveDatedPath (table)', () => {
	const cases: Array<[Grain, string, WeekStart, Date, string]> = [
		['day', 'notes', 1, d(2026, 9, 18), 'notes/2026/09/18'],
		['month', '/notes/', 1, d(2026, 9, 18), 'notes/2026/09'],
		['year', '', 1, d(2026, 9, 18), '2026'],
		['year', '/', 1, d(2026, 9, 18), '2026'],
		['week', 'n', 1, d(2026, 9, 1), 'n/2026/08/31'], // 火曜・月曜始まり → 月またぎ
		['week', 'n', 0, d(2026, 9, 1), 'n/2026/08/30'], // 火曜・日曜始まり
		['week', 'n', 1, d(2026, 1, 1), 'n/2025/12/29'], // 木曜・月曜始まり → 年またぎ
		['week', 'n', 0, d(2026, 9, 20), 'n/2026/09/20'], // 日曜当日・日曜始まり → 当日
		['week', 'n', 1, d(2026, 9, 20), 'n/2026/09/14'], // 日曜当日・月曜始まり → 6日前
		['day', 'a/b', 1, d(2024, 2, 29), 'a/b/2024/02/29'], // 閏日
		['day', 'x', 1, d(2026, 9, 18, 0), 'x/2026/09/18'], // 00:00 ちょうど
		['day', 'x', 1, new Date(2026, 8, 18, 23, 59, 59), 'x/2026/09/18'], // 23:59:59
	];
	it.each(cases)('%s base=%j weekStart=%i %o → %s', (grain, base, ws, now, expected) => {
		expect(resolveDatedPath(grain, base, ws, now)).toBe(expected);
	});
});

describe('weekStartOf (property)', () => {
	it('always lands on weekStart, at 00:00, within the previous 7 days', () => {
		for (let i = 0; i < 400; i++) {
			const now = new Date(2025, 0, 1 + i, 13, 7);
			for (const ws of [0, 1] as WeekStart[]) {
				const w = weekStartOf(now, ws);
				expect(w.getDay()).toBe(ws);
				expect(w.getHours()).toBe(0);
				const diffDays = (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - w.getTime()) / 86_400_000;
				expect(diffDays).toBeGreaterThanOrEqual(0);
				expect(diffDays).toBeLessThan(7);
			}
		}
	});
});

describe('isoWeek', () => {
	it.each([
		[d(2026, 9, 14), 38],
		[d(2026, 9, 19), 38],
		[d(2026, 9, 20), 38], // 日曜は同じ ISO 週
		[d(2026, 8, 31), 36],
		[d(2026, 9, 7), 37],
		[d(2026, 1, 1), 1], // 2026-01-01 は木曜 → 第1週
		[d(2025, 12, 29), 1], // 2026 年の第1週は 2025-12-29(月) から
		[d(2027, 1, 1), 53], // 2027-01-01 は金曜 → 2026 年の第53週
		[d(2021, 1, 3), 53], // 2021-01-03 は日曜 → 2020 年の第53週
		[d(2024, 12, 30), 1], // 2025 年の第1週
		[d(2024, 2, 29), 9],
	])('%o → W%i', (date, week) => expect(isoWeek(date)).toBe(week));
});

describe('effectiveWeekStart', () => {
	it('ISO week numbers force Monday; otherwise the setting is honoured', () => {
		expect(effectiveWeekStart(0, { weekNumber: true })).toBe(1);
		expect(effectiveWeekStart(1, { weekNumber: true })).toBe(1);
		expect(effectiveWeekStart(0)).toBe(0);
		expect(effectiveWeekStart(0, { weekNumber: false })).toBe(0);
	});
});

describe('week folder with ISO week number (strict ISO: Monday-based)', () => {
	it.each([
		['n', 1, d(2026, 9, 19), 'n/2026/09/14(W38)'],
		['n', 1, d(2026, 9, 1), 'n/2026/08/31(W36)'],
		['n', 1, d(2026, 9, 7), 'n/2026/09/07(W37)'],
		['n', 0, d(2026, 9, 19), 'n/2026/09/14(W38)'], // 日曜設定でも月曜固定
		['n', 0, d(2026, 9, 20), 'n/2026/09/14(W38)'], // 日曜当日も前の月曜の週
		['n', 1, d(2026, 1, 1), 'n/2025/12/29(W01)'], // 2桁ゼロ埋め・年またぎ
		['n', 1, d(2027, 1, 1), 'n/2026/12/28(W53)'],
	] as Array<[string, WeekStart, Date, string]>)('base=%s weekStart=%i %o → %s', (base, ws, now, expected) => {
		expect(resolveDatedPath('week', base, ws, now, { weekNumber: true })).toBe(expected);
	});
	it('Sunday weeks still work when the number is off', () => {
		expect(resolveDatedPath('week', 'n', 0, d(2026, 9, 19))).toBe('n/2026/09/13');
	});
	it('is off unless requested, and ignored for other grains', () => {
		expect(resolveDatedPath('week', 'n', 1, d(2026, 9, 19))).toBe('n/2026/09/14');
		expect(resolveDatedPath('day', 'n', 1, d(2026, 9, 19), { weekNumber: true })).toBe('n/2026/09/19');
	});
});

describe('datedSegments', () => {
	it('week and day share the 3-segment shape', () => {
		expect(datedSegments('day', d(2026, 3, 5), 1)).toEqual(['2026', '03', '05']);
		expect(datedSegments('week', d(2026, 3, 5), 1)).toEqual(['2026', '03', '02']);
	});
});

describe('msUntilNextMidnight', () => {
	it('points at 00:00:01 of the next local day', () => {
		const now = new Date(2026, 8, 19, 23, 59, 0);
		expect(msUntilNextMidnight(now)).toBe(61_000);
	});
	it('never returns less than 1s', () => {
		expect(msUntilNextMidnight(new Date(2026, 8, 20, 0, 0, 0, 500))).toBeGreaterThanOrEqual(1000);
	});
});
