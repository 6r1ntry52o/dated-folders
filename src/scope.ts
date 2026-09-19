// 「このファイル作成は対象か」の判定。obsidian を import しない（テスト可能）。
export interface ScopeSettings {
	applyToLinkCreated: boolean;
	extensions: string[];
}

/** 'foo.md' → 'md'。拡張子なし・ドット始まり・末尾ドットは null */
export function extensionOf(name: string): string | null {
	const i = name.lastIndexOf('.');
	if (i <= 0 || i === name.length - 1) return null;
	return name.slice(i + 1).toLowerCase();
}

/**
 * 経路A: getNewFileParent(sourcePath, newFilePath) の引数から判定。
 * 実測（2026-09-19）: Ctrl+N は newFilePath === ''、リンク生成は拡張子なしの名前。
 * 拡張子なし＝md 想定。'/' を含む＝ユーザーがパスを明示＝コア既定へ。
 */
export function appliesToNew(s: ScopeSettings, _sourcePath: string, newFilePath: string | undefined): boolean {
	const p = newFilePath ?? '';
	if (p.includes('/') || p.includes('\\')) return false;
	if (p !== '' && !s.applyToLinkCreated) return false;
	const ext = extensionOf(p);
	return s.extensions.includes(ext ?? 'md');
}

/**
 * 経路B の静的条件: 拡張子が対象・中身が空（新規ノート）・まだ日付フォルダに居ない。
 * 動的条件（1秒以内に開かれる・コア既定の親に着地した）は move-strategy 側。
 */
export function appliesToCreated(
	s: ScopeSettings,
	extension: string,
	size: number,
	parentPath: string,
	targetPath: string,
): boolean {
	if (!s.extensions.includes(extension.toLowerCase())) return false;
	if (size !== 0) return false;
	if (parentPath === targetPath) return false;
	return true;
}

/** 'a, md ,Canvas' → ['a','md','canvas']。空なら ['md'] */
export function parseExtensions(text: string): string[] {
	const out = text
		.split(',')
		.map((x) => x.trim().replace(/^\./, '').toLowerCase())
		.filter(Boolean);
	return out.length ? Array.from(new Set(out)) : ['md'];
}
