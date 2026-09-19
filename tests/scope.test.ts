import { describe, expect, it } from 'vitest';
import { appliesToCreated, appliesToNew, extensionOf, parseExtensions } from '../src/scope';

const s = { applyToLinkCreated: true, extensions: ['md'] };

describe('extensionOf', () => {
	it.each([
		['foo.md', 'md'],
		['Foo.CANVAS', 'canvas'],
		['noext', null],
		['.hidden', null],
		['trailing.', null],
		['', null],
	])('%j → %j', (name, ext) => expect(extensionOf(name)).toBe(ext));
});

describe('appliesToNew (route A)', () => {
	it('Ctrl+N passes an empty newFilePath → applies', () => {
		expect(appliesToNew(s, 'a.md', '')).toBe(true);
		expect(appliesToNew(s, 'a.md', undefined)).toBe(true);
	});
	it('link-created name without extension → treated as md', () => {
		expect(appliesToNew(s, 'a.md', '__linktest')).toBe(true);
	});
	it('explicit folder in the link is respected', () => {
		expect(appliesToNew(s, 'a.md', 'sub/foo')).toBe(false);
	});
	it('applyToLinkCreated=false leaves link creation alone but keeps Ctrl+N', () => {
		const t = { ...s, applyToLinkCreated: false };
		expect(appliesToNew(t, 'a.md', 'foo')).toBe(false);
		expect(appliesToNew(t, 'a.md', '')).toBe(true);
	});
	it('extension filter', () => {
		expect(appliesToNew(s, 'a.md', 'x.canvas')).toBe(false);
		expect(appliesToNew({ ...s, extensions: ['md', 'canvas'] }, 'a.md', 'x.canvas')).toBe(true);
	});
});

describe('appliesToCreated (route B, static part)', () => {
	it('empty md outside the target folder', () => {
		expect(appliesToCreated(s, 'md', 0, '', 'n/2026/09/19')).toBe(true);
	});
	it('already in the target folder', () => {
		expect(appliesToCreated(s, 'md', 0, 'n/2026/09/19', 'n/2026/09/19')).toBe(false);
	});
	it('non-empty file (template / sync) is ignored', () => {
		expect(appliesToCreated(s, 'md', 12, '', 'n/2026/09/19')).toBe(false);
	});
	it('other extensions are ignored', () => {
		expect(appliesToCreated(s, 'png', 0, '', 'n/2026/09/19')).toBe(false);
	});
});

describe('parseExtensions', () => {
	it('normalizes and dedupes', () => {
		expect(parseExtensions(' .MD, canvas ,md')).toEqual(['md', 'canvas']);
	});
	it('falls back to md when empty', () => {
		expect(parseExtensions('  ,')).toEqual(['md']);
	});
});
