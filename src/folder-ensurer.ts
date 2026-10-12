import { normalizePath, type TFolder } from 'obsidian';
import type DatedFoldersPlugin from './main';
import { resolveDatedPath } from './path-resolver';

/**
 * 当日フォルダの同期ルックアップと、ノート作成時の遅延生成。
 * フォルダは「ノートを作る瞬間」にだけ作る（起動・設定変更・日付変化では作らない）。
 * 設定文字列を編集中に途中状態のフォルダが量産されるのを避けるため。
 */
export class FolderEnsurer {
	private ensuring: Promise<TFolder | null> | null = null;

	constructor(private p: DatedFoldersPlugin) {}

	targetPath(now: Date = new Date()): string {
		const s = this.p.settings;
		return normalizePath(resolveDatedPath(s.grain, s.baseFolder, s.weekStart, now, { weekNumber: s.weekNumber }));
	}

	/** 同期。パッチから毎回呼ばれる。フォルダが無ければ null（作らない）。毎回引くのでキャッシュの陳腐化もない */
	currentFolder(): TFolder | null {
		return this.lookup(this.targetPath());
	}

	/** 非同期。ノート作成時（遅延生成）と明示コマンドからだけ呼ぶ。同時呼び出しは1本にまとめる */
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
		const folder = this.lookup(path);
		if (this.p.settings.pruneEmptyDatedFolders) await this.prune(path);
		this.p.log.debug('ensure', path, folder ? 'ok' : 'missing');
		return folder;
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

	/** 自分が作った・空・現在の対象でない フォルダだけを削除する（起動時と遅延生成の後に呼ぶ） */
	async prune(current: string): Promise<void> {
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
