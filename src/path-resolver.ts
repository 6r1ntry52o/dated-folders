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

/**
 * ISO 8601 週番号（1〜53・月曜始まり・年の最初の木曜を含む週が第1週）。ローカル日付で計算。
 */
export function isoWeek(date: Date): number {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
	d.setDate(d.getDate() - dow + 3); // この ISO 週の木曜日
	const firstThu = new Date(d.getFullYear(), 0, 4); // 1/4 は必ず第1週に含まれる
	const firstDow = (firstThu.getDay() + 6) % 7;
	firstThu.setDate(firstThu.getDate() - firstDow + 3);
	return 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86_400_000));
}

/**
 * 週フォルダに付ける週番号。月曜始まりなら開始日の ISO 週番号。
 * 日曜始まりならその週に含まれる月曜日（開始日+1）の ISO 週番号＝ISO 番号を 1 日ずらして使う。
 */
export function weekNumberOf(weekStartDate: Date, weekStart: WeekStart): number {
	const monday = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + (weekStart === 0 ? 1 : 0));
	return isoWeek(monday);
}

export interface PathOptions {
	/** week 粒度のとき末尾に "(Wnn)" を付ける（ISO 週番号・2桁ゼロ埋め） */
	weekNumber?: boolean;
}

export function datedSegments(grain: Grain, now: Date, weekStart: WeekStart, opts: PathOptions = {}): string[] {
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
			return [y, m, opts.weekNumber ? `${d}(W${pad2(weekNumberOf(b, weekStart))})` : d];
		case 'day':
			return [y, m, d];
	}
}

/** base の前後スラッシュは除去。'' / '/' は vault ルート扱い。normalizePath は呼び出し側で掛ける。 */
export function resolveDatedPath(grain: Grain, base: string, weekStart: WeekStart, now: Date, opts: PathOptions = {}): string {
	const trimmed = base.replace(/^\/+|\/+$/g, '');
	return [trimmed, ...datedSegments(grain, now, weekStart, opts)].filter(Boolean).join('/');
}

/** 次の 00:00:01（ローカル）までのミリ秒。ロールオーバータイマー用。 */
export function msUntilNextMidnight(now: Date): number {
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
	return Math.max(1000, next.getTime() - now.getTime());
}
