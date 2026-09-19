import type { Grain, WeekStart } from './path-resolver';

export type Strategy = 'auto' | 'patch' | 'move';

export interface Settings {
	baseFolder: string; // '' = vault ルート。normalizePath 済みで保存
	grain: Grain;
	weekStart: WeekStart; // grain==='week' のときだけ意味を持つ
	strategy: Strategy; // auto = A＋B安全網 / patch = Aのみ / move = Bのみ
	applyToLinkCreated: boolean;
	extensions: string[]; // 既定 ['md']
	pruneEmptyDatedFolders: boolean;
	debug: boolean;
	/** 自分が作った日付フォルダ（prune の対象はここに載っているものだけ） */
	createdFolders: string[];
}

export const DEFAULT_SETTINGS: Settings = {
	baseFolder: '',
	grain: 'day',
	weekStart: 1,
	strategy: 'auto',
	applyToLinkCreated: true,
	extensions: ['md'],
	pruneEmptyDatedFolders: false,
	debug: false,
	createdFolders: [],
};
