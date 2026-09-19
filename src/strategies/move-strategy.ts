import { Notice, TFile, type EventRef, type TAbstractFile, type TFolder } from 'obsidian';
import type DatedFoldersPlugin from '../main';
import { appliesToCreated } from '../scope';
import type { PlacementStrategy } from './strategy';

const OPEN_WINDOW_MS = 1000;
const PATCH_HIT_WINDOW_MS = 1500;

/**
 * 経路B（安全網）: 経路A を素通りした新規ノート（例: createNewMarkdownFile(null, name)）だけを
 * 日付フォルダへ移す。誤爆防止＝
 *   ① 拡張子が対象  ② size 0  ③ まだ日付フォルダに居ない        （scope.appliesToCreated）
 *   ④ 直近 1.5 秒に A がヒットしていない
 *   ⑤ 着地先が「コア既定の親」または vault ルート＝コアが我々を経由せず既定へ置いた形跡
 *   ⑥ 作成から 1 秒以内にユーザーが開いた（同期由来の流し込みは開かれない）
 * デイリーノート等、別フォルダに意図して作られるものは ⑤ で除外される。
 */
export class MoveStrategy implements PlacementStrategy {
	private refs: EventRef[] = [];
	private pending = new Map<string, number>(); // path → timeout id
	private misses = 0;
	private noticed = false;

	constructor(private p: DatedFoldersPlugin) {
		this.p.register(() => this.disable());
	}

	get active(): boolean {
		return this.refs.length > 0;
	}

	enable(): void {
		if (this.active) return;
		const { vault, workspace } = this.p.app;
		this.refs.push(vault.on('create', (f) => this.onCreate(f)));
		this.refs.push(workspace.on('file-open', (f) => f && this.onOpen(f)));
	}

	disable(): void {
		for (const r of this.refs) this.p.app.vault.offref(r);
		this.refs = [];
		for (const id of this.pending.values()) window.clearTimeout(id);
		this.pending.clear();
	}

	private onCreate(f: TAbstractFile): void {
		try {
			if (!(f instanceof TFile) || !f.parent) return;
			if (Date.now() - this.p.patch.lastHitAt < PATCH_HIT_WINDOW_MS) return; // ④ A が処理した
			const target = this.p.ensurer.targetPath();
			if (!appliesToCreated(this.p.settings, f.extension, f.stat.size, f.parent.path, target)) return; // ①②③
			if (!this.landedOnDefault(f.parent)) return; // ⑤
			const path = f.path;
			const id = window.setTimeout(() => this.pending.delete(path), OPEN_WINDOW_MS); // ⑥ 期限
			this.pending.set(path, id);
			this.p.log.debug('move candidate', path);
		} catch (e) {
			this.p.log.error(e);
		}
	}

	private onOpen(f: TFile): void {
		const id = this.pending.get(f.path);
		if (id === undefined) return;
		window.clearTimeout(id);
		this.pending.delete(f.path);
		void this.move(f).catch((e) => this.p.log.error(e));
	}

	/** ⑤ コアが既定で選ぶ親（パッチ前の実装で計算）か、vault ルートか */
	private landedOnDefault(parent: TFolder): boolean {
		if (parent.isRoot()) return true;
		const fm = this.p.app.fileManager;
		const source = this.p.app.workspace.getActiveFile()?.path ?? '';
		try {
			const orig = this.p.patch.orig;
			const def = orig ? orig.call(fm, source, '') : fm.getNewFileParent(source, '');
			return def.path === parent.path;
		} catch (e) {
			this.p.log.error(e);
			return false;
		}
	}

	private async move(f: TFile): Promise<void> {
		const folder = await this.p.ensurer.ensure();
		if (!folder) return;
		if (f.parent?.path === folder.path) return;
		const dest = this.uniquePath(folder.path, f.basename, f.extension);
		await this.p.app.fileManager.renameFile(f, dest);
		this.p.log.debug('moved', f.path, '->', dest);
		this.misses++;
		if (this.misses >= 2 && !this.noticed && this.p.settings.strategy === 'auto' && this.p.patch.active) {
			this.noticed = true;
			new Notice('Dated Folders: the patch strategy may not be taking effect; notes are being moved after creation instead.');
		}
	}

	private uniquePath(folderPath: string, basename: string, ext: string): string {
		const join = (name: string): string => (folderPath ? `${folderPath}/${name}.${ext}` : `${name}.${ext}`);
		let candidate = join(basename);
		for (let i = 1; this.p.app.vault.getAbstractFileByPath(candidate); i++) candidate = join(`${basename} ${i}`);
		return candidate;
	}
}
