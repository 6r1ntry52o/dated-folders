import { normalizePath, type TFolder } from 'obsidian';
import type DatedFoldersPlugin from './main';
import { msUntilNextMidnight, resolveDatedPath } from './path-resolver';

/** 当日フォルダの事前生成・同期ルックアップ・日付ロールオーバー監視 */
export class FolderEnsurer {
	private cachedPath: string | null = null;
	private cached: TFolder | null = null;
	private midnightTimer: number | null = null;
	private ensuring: Promise<TFolder | null> | null = null;

	constructor(private p: DatedFoldersPlugin) {
		this.p.register(() => this.clearMidnight());
	}

	targetPath(now: Date = new Date()): string {
		const s = this.p.settings;
		return normalizePath(resolveDatedPath(s.grain, s.baseFolder, s.weekStart, now, { weekNumber: s.weekNumber }));
	}

	/** 同期。パッチから毎回呼ばれる。パスが変わっていれば再ルックアップ（ロールオーバー直後の保険） */
	currentFolder(): TFolder | null {
		const path = this.targetPath();
		if (path !== this.cachedPath || !this.cached) {
			this.cachedPath = path;
			this.cached = this.lookup(path);
		}
		return this.cached;
	}

	/** 非同期。起動時・設定変更時・日付変化時。同時呼び出しは1本にまとめる */
	ensure(now: Date = new Date()): Promise<TFolder | null> {
		if (this.ensuring) return this.ensuring;
		this.ensuring = this.doEnsure(now).finally(() => {
			this.ensuring = null;
		});
		return this.ensuring;
	}

	private async doEnsure(now: Date): Promise<TFolder | null> {
		const path = this.targetPath(now);
		const vault = this.p.app.vault;
		if (path !== '' && !this.lookup(path)) {
			// createFolder は中間フォルダを再帰生成する（1.13.7 実測）。親ループは将来の仕様変更への防御。
			let acc = '';
			for (const seg of path.split('/')) {
				acc = acc ? `${acc}/${seg}` : seg;
				if (this.lookup(acc)) continue;
				try {
					await vault.createFolder(acc);
					this.recordCreated(acc);
				} catch (e) {
					if (!this.lookup(acc)) throw e; // 競合で既に存在 → 握る。それ以外は投げる
				}
			}
		}
		this.cachedPath = path;
		this.cached = this.lookup(path);
		this.scheduleMidnight(now);
		if (this.p.settings.pruneEmptyDatedFolders) await this.prune(path);
		this.p.log.debug('ensure', path, this.cached ? 'ok' : 'missing');
		return this.cached;
	}

	start(): void {
		// 保険①: 分単位ポーリング（タイマーが飛んだ・時計が変わった）
		this.p.registerInterval(
			window.setInterval(() => {
				if (this.targetPath() !== this.cachedPath) void this.ensure().catch((e) => this.p.log.error(e));
			}, 60_000),
		);
		// 保険②: スリープ復帰・モバイル復帰
		this.p.registerDomEvent(document, 'visibilitychange', () => {
			if (!document.hidden && this.targetPath() !== this.cachedPath) {
				void this.ensure().catch((e) => this.p.log.error(e));
			}
		});
	}

	/** 本線: 次の 00:00:01 に一発。unload 時は constructor の register で解除 */
	private scheduleMidnight(now: Date): void {
		this.clearMidnight();
		this.midnightTimer = window.setTimeout(() => {
			this.midnightTimer = null;
			void this.ensure().catch((e) => this.p.log.error(e));
		}, msUntilNextMidnight(now));
	}

	private clearMidnight(): void {
		if (this.midnightTimer !== null) {
			window.clearTimeout(this.midnightTimer);
			this.midnightTimer = null;
		}
	}

	private lookup(path: string): TFolder | null {
		if (path === '') return this.p.app.vault.getRoot();
		return this.p.app.vault.getFolderByPath(path);
	}

	private recordCreated(path: string): void {
		const list = this.p.settings.createdFolders;
		if (!list.includes(path)) {
			list.push(path);
			void this.p.saveSettings();
		}
	}

	/** 自分が作った・空・現在の対象でない フォルダだけを削除する */
	private async prune(current: string): Promise<void> {
		const vault = this.p.app.vault;
		const keep: string[] = [];
		let changed = false;
		// 深い順に処理＝子を消してから親を見る
		const sorted = [...this.p.settings.createdFolders].sort((a, b) => b.length - a.length);
		for (const path of sorted) {
			if (path === current || current.startsWith(path + '/')) {
				keep.push(path);
				continue;
			}
			const folder = vault.getFolderByPath(path);
			if (!folder) {
				changed = true; // もう無い → 記録から落とす
				continue;
			}
			if (folder.children.length === 0) {
				try {
					await vault.trash(folder, true);
					changed = true;
					this.p.log.debug('pruned', path);
					continue;
				} catch (e) {
					this.p.log.error(e);
				}
			}
			keep.push(path);
		}
		if (changed) {
			this.p.settings.createdFolders = keep;
			await this.p.saveSettings();
		}
	}
}
