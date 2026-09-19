// 純関数のみ。obsidian を import しない（唯一のユニットテスト対象）。
export type Grain = 'year' | 'month' | 'week' | 'day';
/** Date#getDay() と同じ。0=日曜, 1=月曜 */
export type WeekStart = 0 | 1;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** 週の開始日（ローカル日付・時刻 00:00）。moment / locale に依存しない。 */
export function weekStartOf(now: Date, weekStart: WeekStart): Date {
	const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const diff = (d.getDay() - weekStart + 7) % 7; // 0..6
	d.setDate(d.getDate() - diff); // 月・年またぎは Date が繰り下げる
	return d;
}

export function datedSegments(grain: Grain, now: Date, weekStart: WeekStart): string[] {
	const b = grain === 'week' ? weekStartOf(now, weekStart) : now;
	const y = String(b.getFullYear());
	const m = pad2(b.getMonth() + 1);
	const d = pad2(b.getDate());
	switch (grain) {
		case 'year':
			return [y];
		case 'month':
			return [y, m];
		case 'week':
		case 'day':
			return [y, m, d];
	}
}

/** base の前後スラッシュは除去。'' / '/' は vault ルート扱い。normalizePath は呼び出し側で掛ける。 */
export function resolveDatedPath(grain: Grain, base: string, weekStart: WeekStart, now: Date): string {
	const trimmed = base.replace(/^\/+|\/+$/g, '');
	return [trimmed, ...datedSegments(grain, now, weekStart)].filter(Boolean).join('/');
}

/** 次の 00:00:01（ローカル）までのミリ秒。ロールオーバータイマー用。 */
export function msUntilNextMidnight(now: Date): number {
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
	return Math.max(1000, next.getTime() - now.getTime());
}
