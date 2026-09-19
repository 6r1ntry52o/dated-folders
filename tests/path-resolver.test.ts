import { describe, expect, it } from 'vitest';
import { datedSegments, msUntilNextMidnight, resolveDatedPath, weekStartOf, type Grain, type WeekStart } from '../src/path-resolver';

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
