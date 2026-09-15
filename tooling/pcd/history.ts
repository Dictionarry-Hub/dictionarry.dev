// Entity history replay. Executes op files one at a time and records, per
// entity, what each file changed. History is derived from the same replay
// that produces the entity state, and the final assertion proves the two
// agree, so a page can never show history that disagrees with its content.
//
// Pure fold over parsed op files: executing SQL and extracting entities are
// injected, so the bookkeeping is testable without SQLite.

import { diffEntities } from './diff.js';
import { IGNORED_ENTITY_TYPES, type ParsedOp, type ParsedOpFile } from './ops.js';
import type { OpFileCommit } from './fetch.js';
import type { EntityHistory, EntityRef, HistoryEntry } from '../../src/lib/types/pcd.js';

export type { EntityHistory, EntityRef, HistoryEntry };

export interface HistorySource {
	files: ParsedOpFile[];
	commits: Map<string, OpFileCommit>;
	exec(sql: string): void;
	/** Current state of one entity, or null when it does not exist. */
	extractOne(entityType: string, name: string): unknown;
	/** Current state of every entity, keyed like the history. */
	extractAll(): Map<string, unknown>;
}

export function entityKey(entityType: string, name: string): string {
	return `${entityType}:${name}`;
}

export function splitKey(key: string): EntityRef {
	const index = key.indexOf(':');
	return { entityType: key.slice(0, index), name: key.slice(index + 1) };
}

export function buildHistory(source: HistorySource): EntityHistory {
	const cache = new Map<string, unknown>();
	const history = new Map<string, HistoryEntry[]>();

	const files = [...source.files].sort((a, b) => a.number - b.number);

	for (const file of files) {
		source.exec(file.text);

		const commit = source.commits.get(file.file);
		const meta = {
			op: file.number,
			title: file.title ?? commit?.message ?? stem(file.file),
			date: commit?.date ?? file.exportedAt ?? '',
			hash: commit?.hash ?? null
		};

		if (file.touchedUnknown || file.ops.length === 0) {
			replayFull(source, cache, history, meta);
			continue;
		}

		replayIncremental(source, cache, history, meta, file.ops);
	}

	const final = source.extractAll();
	assertConsistent(cache, final);

	const result: EntityHistory = {};
	for (const [key, entries] of history) {
		if (!final.has(key)) continue;
		result[key] = entries.map((entry) => ({
			...entry,
			related: entry.related.filter((ref) => final.has(entityKey(ref.entityType, ref.name)))
		}));
	}
	return result;
}

type EntryMeta = Pick<HistoryEntry, 'op' | 'title' | 'date' | 'hash'>;

interface Transition {
	before: unknown;
	after: unknown;
}

function replayIncremental(
	source: HistorySource,
	cache: Map<string, unknown>,
	history: Map<string, HistoryEntry[]>,
	meta: EntryMeta,
	allOps: ParsedOp[]
): void {
	const ops = allOps.filter((op) => !IGNORED_ENTITY_TYPES.has(op.entityType));

	// Touched set: every op's own entity plus any same-type name its SQL
	// mentions (the old side of a rename, a delete-and-reinsert rename).
	const touched = new Set<string>();
	for (const op of ops) {
		touched.add(entityKey(op.entityType, op.name));
		for (const name of op.mentions) touched.add(entityKey(op.entityType, name));
	}

	// Re-read each touched entity. Entities that vanished pull their
	// dependents into the touched set so cascades are attributed here.
	const transitions = new Map<string, Transition>();
	const queue = [...touched];
	while (queue.length > 0) {
		const key = queue.shift() as string;
		if (transitions.has(key)) continue;
		const { entityType, name } = splitKey(key);
		const before = cache.get(key);
		const after = source.extractOne(entityType, name) ?? undefined;
		transitions.set(key, { before, after });
		if (before !== undefined && after === undefined) {
			for (const dependent of dependents(cache, entityType, name)) {
				if (!transitions.has(dependent)) queue.push(dependent);
			}
		}
	}

	// Rename resolution: an op whose entity appeared while exactly one of the
	// names it mentions disappeared. Chains through names that only existed
	// mid-file (a rename via a temporary name) to find the original.
	const opsByKey = new Map<string, ParsedOp[]>();
	for (const op of ops) {
		const key = entityKey(op.entityType, op.name);
		opsByKey.set(key, [...(opsByKey.get(key) ?? []), op]);
	}
	const renamedFrom = new Map<string, string>();
	const consumed = new Set<string>();
	for (const [key, t] of transitions) {
		if (t.before !== undefined || t.after === undefined) continue;
		const origins = renameOrigins(key, opsByKey, transitions, new Set());
		if (origins.length === 1 && !consumed.has(origins[0])) {
			renamedFrom.set(key, origins[0]);
			consumed.add(origins[0]);
		}
	}

	const changed: string[] = [];
	const pending: { key: string; entry: HistoryEntry }[] = [];

	for (const [key, { before, after }] of transitions) {
		if (after === undefined) cache.delete(key);
		else cache.set(key, after);

		if (consumed.has(key)) continue;

		const oldKey = renamedFrom.get(key);
		let entry: HistoryEntry | null;
		if (oldKey !== undefined) {
			const oldBefore = transitions.get(oldKey)?.before;
			const changes = diffEntities(oldBefore, after).filter((c) => c.path !== 'name');
			entry = {
				...meta,
				kind: 'renamed',
				renamedFrom: splitKey(oldKey).name,
				changes,
				related: []
			};
			const entries = history.get(oldKey);
			if (entries) {
				history.set(key, [...entries, ...(history.get(key) ?? [])]);
				history.delete(oldKey);
			}
		} else {
			entry = entryFor(meta, before, after);
		}
		if (entry === null) continue;
		pending.push({ key, entry });
		changed.push(key);
	}

	for (const { key, entry } of pending) {
		entry.related = changed.filter((other) => other !== key).map(splitKey);
		push(history, key, entry);
	}
}

function renameOrigins(
	key: string,
	opsByKey: Map<string, ParsedOp[]>,
	transitions: Map<string, Transition>,
	visited: Set<string>
): string[] {
	visited.add(key);
	const origins = new Set<string>();
	for (const op of opsByKey.get(key) ?? []) {
		for (const name of op.mentions) {
			const other = entityKey(op.entityType, name);
			if (visited.has(other)) continue;
			const t = transitions.get(other);
			if (t === undefined) continue;
			if (t.before !== undefined && t.after === undefined) origins.add(other);
			else if (t.before === undefined && t.after === undefined) {
				for (const origin of renameOrigins(other, opsByKey, transitions, visited)) {
					origins.add(origin);
				}
			}
		}
	}
	return [...origins];
}

function entryFor(meta: EntryMeta, before: unknown, after: unknown): HistoryEntry | null {
	if (before === undefined && after === undefined) return null;
	if (before === undefined) return { ...meta, kind: 'created', changes: [], related: [] };
	if (after === undefined) return { ...meta, kind: 'deleted', changes: [], related: [] };

	const changes = diffEntities(before, after);
	if (changes.length === 0) return null;
	return { ...meta, kind: 'updated', changes, related: [] };
}

// Files without a usable touched set (the bulk import, hand-written batches)
// are diffed in full. Related links are omitted: for the bulk import they
// would list every entity in the database.
function replayFull(
	source: HistorySource,
	cache: Map<string, unknown>,
	history: Map<string, HistoryEntry[]>,
	meta: EntryMeta
): void {
	const current = source.extractAll();
	const keys = new Set([...cache.keys(), ...current.keys()]);
	for (const key of keys) {
		const entry = entryFor(meta, cache.get(key), current.get(key));
		if (entry !== null) push(history, key, entry);
	}
	cache.clear();
	for (const [key, value] of current) cache.set(key, value);
}

// Foreign keys cascade on rename and delete. Current Profilarr exports emit
// explicit ops for the dependents, but older or hand-written batches may not,
// so dependents join the touched set and get attributed to the same file.
function dependents(cache: Map<string, unknown>, entityType: string, name: string): string[] {
	const keys: string[] = [];
	if (entityType === 'regular_expression') {
		for (const [key, value] of cache) {
			if (!key.startsWith('custom_format:')) continue;
			const conditions = (
				value as { conditions?: { data?: { regularExpressionName?: string } }[] }
			).conditions;
			if (conditions?.some((c) => c.data?.regularExpressionName === name)) keys.push(key);
		}
	} else if (entityType === 'custom_format') {
		for (const [key, value] of cache) {
			if (!key.startsWith('quality_profile:')) continue;
			const scoring = (value as { scoring?: { customFormatName?: string }[] }).scoring;
			if (scoring?.some((s) => s.customFormatName === name)) keys.push(key);
		}
	}
	return keys;
}

function assertConsistent(cache: Map<string, unknown>, final: Map<string, unknown>): void {
	const mismatched: string[] = [];
	for (const key of new Set([...cache.keys(), ...final.keys()])) {
		if (JSON.stringify(cache.get(key)) !== JSON.stringify(final.get(key))) mismatched.push(key);
	}
	if (mismatched.length > 0) {
		const shown = mismatched.slice(0, 10).join(', ');
		const more = mismatched.length > 10 ? ` (+${mismatched.length - 10} more)` : '';
		throw new Error(
			`History replay does not match the compiled state for ${mismatched.length} entities: ${shown}${more}`
		);
	}
}

function push(history: Map<string, HistoryEntry[]>, key: string, entry: HistoryEntry): void {
	const entries = history.get(key);
	if (entries) entries.push(entry);
	else history.set(key, [entry]);
}

function stem(file: string): string {
	return file.replace(/^\d+\./, '').replace(/\.sql$/, '');
}
