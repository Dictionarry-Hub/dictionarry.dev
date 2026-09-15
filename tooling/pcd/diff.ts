// Structural diff between two extracted entities. Objects compare key by
// key. Arrays of objects are matched by a key derived from the shapes in
// src/lib/types/pcd.ts so a changed condition reads as one change under
// conditions[Name] rather than a positional shuffle. Arrays of primitives
// (tags, group members) compare whole so ordering changes stay visible.

import type { EntityChange as Change } from '../../src/lib/types/pcd.js';

export type { Change };

export function diffEntities(before: unknown, after: unknown): Change[] {
	const changes: Change[] = [];
	walk('', before, after, changes);
	return changes;
}

function walk(path: string, a: unknown, b: unknown, out: Change[]): void {
	if (isRecord(a) && isRecord(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const key of [...keys].sort()) {
			const child = path === '' ? key : `${path}.${key}`;
			if (!(key in a)) out.push({ path: child, kind: 'added', to: b[key] });
			else if (!(key in b)) out.push({ path: child, kind: 'removed', from: a[key] });
			else walk(child, a[key], b[key], out);
		}
		return;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		const keyedA = keyItems(a);
		const keyedB = keyItems(b);
		if (keyedA && keyedB) {
			const keys = new Set([...keyedA.keys(), ...keyedB.keys()]);
			for (const key of keys) {
				const child = `${path}[${key}]`;
				if (!keyedA.has(key)) out.push({ path: child, kind: 'added', to: keyedB.get(key) });
				else if (!keyedB.has(key))
					out.push({ path: child, kind: 'removed', from: keyedA.get(key) });
				else walk(child, keyedA.get(key), keyedB.get(key), out);
			}
			return;
		}
		if (JSON.stringify(a) !== JSON.stringify(b)) {
			out.push({ path, kind: 'changed', from: a, to: b });
		}
		return;
	}

	if (!Object.is(a, b)) {
		out.push({ path, kind: 'changed', from: a, to: b });
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Map array items by identity key, or null when any item has no key. */
function keyItems(items: unknown[]): Map<string, unknown> | null {
	if (items.length === 0) return new Map();
	const map = new Map<string, unknown>();
	for (const item of items) {
		const key = itemKey(item);
		if (key === null || map.has(key)) return null;
		map.set(key, item);
	}
	return map;
}

export function itemKey(item: unknown): string | null {
	if (!isRecord(item)) return null;
	if ('customFormatName' in item)
		return `${String(item.customFormatName)}|${String(item.arrType)}`;
	if ('qualityName' in item) return String(item.qualityName);
	if ('title' in item) return String(item.title);
	if ('quality' in item || 'group' in item) {
		if (typeof item.quality === 'string') return item.quality;
		const group = item.group;
		if (isRecord(group) && typeof group.name === 'string') return group.name;
		return `#${String(item.position)}`;
	}
	if ('name' in item) return String(item.name);
	return null;
}
