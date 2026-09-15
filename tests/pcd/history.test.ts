import { describe, expect, it } from 'vitest';
import { buildHistory, entityKey, type HistorySource } from '../../tooling/pcd/history.js';
import { parseOpFile, type OpVerb } from '../../tooling/pcd/ops.js';
import type { OpFileCommit } from '../../tooling/pcd/fetch.js';

// The fake database is a Map of entity key to entity. Each fixture file
// carries real op markers (so the parser is exercised) plus a script that
// mutates the Map when the file is "executed".

type World = Map<string, unknown>;

interface OpSpec {
	verb: OpVerb;
	type: string;
	name: string;
	sql?: string;
}

interface FileSpec {
	number: number;
	title?: string;
	ops?: OpSpec[];
	bulk?: boolean;
	apply: (world: World) => void;
}

function opText(op: OpSpec, id: number): string {
	const sql = op.sql ?? `-- ${op.verb} ${op.name}`;
	return `-- --- BEGIN op ${id} ( ${op.verb} ${op.type} "${op.name}" )\n${sql}\n-- --- END op ${id}\n`;
}

function source(specs: FileSpec[], commits: Map<string, OpFileCommit> = new Map()): HistorySource {
	const world: World = new Map();
	const scripts = new Map<string, (world: World) => void>();
	const files = specs.map((spec) => {
		const file = `${spec.number}.${(spec.title ?? 'file').toLowerCase().replace(/\W+/g, '-')}.sql`;
		const header = spec.bulk
			? '-- Generated at: 2026-01-01T00:00:00Z\n'
			: `-- @name: ${spec.title ?? 'Batch'}\n-- @exportedAt: 2026-02-0${spec.number}T00:00:00Z\n`;
		const text =
			header + (spec.ops ?? []).map((op, i) => opText(op, spec.number * 100 + i)).join('');
		scripts.set(text, spec.apply);
		return parseOpFile(text, file);
	});
	return {
		files,
		commits,
		exec: (sql) => {
			const script = scripts.get(sql);
			if (!script) throw new Error('unknown file text');
			script(world);
		},
		extractOne: (type, name) => structuredClone(world.get(entityKey(type, name)) ?? null),
		extractAll: () => structuredClone(world)
	};
}

const regex = (name: string, pattern = 'a') => ({ name, pattern, tags: [] });
const cf = (name: string, regexName: string) => ({
	name,
	conditions: [{ name: regexName, data: { regularExpressionName: regexName } }]
});

describe('buildHistory', () => {
	it('records the bulk import as creation and later files as updates', () => {
		const history = buildHistory(
			source([
				{ number: 0, bulk: true, apply: (w) => w.set('regular_expression:R', regex('R')) },
				{
					number: 1,
					title: 'Tweak R',
					ops: [{ verb: 'update', type: 'regular_expression', name: 'R' }],
					apply: (w) => w.set('regular_expression:R', regex('R', 'b'))
				}
			])
		);

		expect(history['regular_expression:R']).toEqual([
			expect.objectContaining({ op: 0, kind: 'created', changes: [], related: [] }),
			expect.objectContaining({
				op: 1,
				kind: 'updated',
				title: 'Tweak R',
				date: '2026-02-01T00:00:00Z',
				hash: null,
				changes: [{ path: 'pattern', kind: 'changed', from: 'a', to: 'b' }]
			})
		]);
	});

	it('uses commit metadata when available', () => {
		const commits = new Map<string, OpFileCommit>([
			[
				'1.tweak-r.sql',
				{ hash: 'abc', date: '2026-03-01T10:00:00+00:00', message: 'Tweak R' }
			]
		]);
		const history = buildHistory(
			source(
				[
					{
						number: 0,
						bulk: true,
						apply: (w) => w.set('regular_expression:R', regex('R'))
					},
					{
						number: 1,
						title: 'Tweak R',
						ops: [{ verb: 'update', type: 'regular_expression', name: 'R' }],
						apply: (w) => w.set('regular_expression:R', regex('R', 'b'))
					}
				],
				commits
			)
		);

		expect(history['regular_expression:R'][1]).toMatchObject({
			hash: 'abc',
			date: '2026-03-01T10:00:00+00:00'
		});
	});

	it('derives the kind from state, ignoring the marker verb', () => {
		const history = buildHistory(
			source([
				{
					number: 1,
					ops: [{ verb: 'update', type: 'regular_expression', name: 'R' }],
					apply: (w) => w.set('regular_expression:R', regex('R'))
				}
			])
		);

		expect(history['regular_expression:R'][0].kind).toBe('created');
	});

	it('emits one entry per entity per file and skips no-op files', () => {
		const history = buildHistory(
			source([
				{ number: 0, bulk: true, apply: (w) => w.set('regular_expression:R', regex('R')) },
				{
					number: 1,
					ops: [
						{ verb: 'update', type: 'regular_expression', name: 'R' },
						{ verb: 'update', type: 'regular_expression', name: 'R' }
					],
					apply: (w) => w.set('regular_expression:R', regex('R', 'b'))
				},
				{
					number: 2,
					ops: [{ verb: 'update', type: 'regular_expression', name: 'R' }],
					apply: () => {}
				}
			])
		);

		expect(history['regular_expression:R'].map((e) => e.op)).toEqual([0, 1]);
	});

	it('follows a rename, moving earlier history to the new name', () => {
		const history = buildHistory(
			source([
				{
					number: 0,
					bulk: true,
					apply: (w) => w.set('regular_expression:Old', regex('Old'))
				},
				{
					number: 1,
					title: 'Rename',
					ops: [
						{
							verb: 'update',
							type: 'regular_expression',
							name: 'New',
							sql: `update "regular_expressions" set "name" = 'New', "pattern" = 'b' where "name" = 'Old';`
						}
					],
					apply: (w) => {
						w.delete('regular_expression:Old');
						w.set('regular_expression:New', regex('New', 'b'));
					}
				}
			])
		);

		expect(history['regular_expression:Old']).toBeUndefined();
		expect(history['regular_expression:New'].map((e) => e.kind)).toEqual([
			'created',
			'renamed'
		]);
		expect(history['regular_expression:New'][1]).toMatchObject({
			renamedFrom: 'Old',
			changes: [{ path: 'pattern', kind: 'changed', from: 'a', to: 'b' }]
		});
	});

	it('chains a rename through a temporary name inside one file', () => {
		const history = buildHistory(
			source([
				{
					number: 0,
					bulk: true,
					apply: (w) => w.set('radarr_naming:default', { name: 'default' })
				},
				{
					number: 1,
					ops: [
						{
							verb: 'update',
							type: 'radarr_naming',
							name: 'renamed',
							sql: `update "radarr_naming" set "name" = 'renamed' where "name" = 'default';`
						},
						{
							verb: 'update',
							type: 'radarr_naming',
							name: 'Radarr',
							sql: `update "radarr_naming" set "name" = 'Radarr' where "name" = 'renamed';`
						}
					],
					apply: (w) => {
						w.delete('radarr_naming:default');
						w.set('radarr_naming:Radarr', { name: 'Radarr' });
					}
				}
			])
		);

		expect(Object.keys(history)).toEqual(['radarr_naming:Radarr']);
		expect(history['radarr_naming:Radarr'][1]).toMatchObject({
			kind: 'renamed',
			renamedFrom: 'default',
			changes: []
		});
	});

	it('drops entities that no longer exist and prunes related links to them', () => {
		const history = buildHistory(
			source([
				{
					number: 0,
					bulk: true,
					apply: (w) => {
						w.set('regular_expression:A', regex('A'));
						w.set('regular_expression:B', regex('B'));
					}
				},
				{
					number: 1,
					ops: [
						{ verb: 'delete', type: 'regular_expression', name: 'A' },
						{ verb: 'update', type: 'regular_expression', name: 'B' }
					],
					apply: (w) => {
						w.delete('regular_expression:A');
						w.set('regular_expression:B', regex('B', 'b'));
					}
				}
			])
		);

		expect(history['regular_expression:A']).toBeUndefined();
		expect(history['regular_expression:B'][1].related).toEqual([]);
	});

	it('records nothing for an entity created and deleted in the same file', () => {
		const history = buildHistory(
			source([
				{
					number: 1,
					ops: [
						{ verb: 'create', type: 'regular_expression', name: 'T' },
						{ verb: 'delete', type: 'regular_expression', name: 'T' },
						{ verb: 'create', type: 'regular_expression', name: 'K' }
					],
					apply: (w) => w.set('regular_expression:K', regex('K'))
				}
			])
		);

		expect(Object.keys(history)).toEqual(['regular_expression:K']);
		expect(history['regular_expression:K'][0].related).toEqual([]);
	});

	it('lists other entities changed in the same file as related, excluding test entities', () => {
		const history = buildHistory(
			source([
				{
					number: 1,
					ops: [
						{ verb: 'create', type: 'regular_expression', name: 'R' },
						{ verb: 'create', type: 'custom_format', name: 'C' },
						{ verb: 'create', type: 'test_entity', name: 'ignored' }
					],
					apply: (w) => {
						w.set('regular_expression:R', regex('R'));
						w.set('custom_format:C', cf('C', 'R'));
					}
				}
			])
		);

		expect(history['custom_format:C'][0].related).toEqual([
			{ entityType: 'regular_expression', name: 'R' }
		]);
		expect(history['regular_expression:R'][0].related).toEqual([
			{ entityType: 'custom_format', name: 'C' }
		]);
	});

	it('attributes a cascade to the file that deleted the dependency', () => {
		const history = buildHistory(
			source([
				{
					number: 0,
					bulk: true,
					apply: (w) => {
						w.set('regular_expression:R', regex('R'));
						w.set('custom_format:C', cf('C', 'R'));
					}
				},
				{
					number: 1,
					// No marker for C, but deleting R cascades its condition away.
					ops: [{ verb: 'delete', type: 'regular_expression', name: 'R' }],
					apply: (w) => {
						w.delete('regular_expression:R');
						w.set('custom_format:C', { name: 'C', conditions: [] });
					}
				}
			])
		);

		expect(history['custom_format:C'][1]).toMatchObject({
			op: 1,
			kind: 'updated',
			changes: [expect.objectContaining({ path: 'conditions[R]', kind: 'removed' })]
		});
	});

	it('falls back to a full diff for a file with an unlabeled op', () => {
		const text = `-- @name: Manual\n-- --- BEGIN op 5\nupdate x;\n-- --- END op 5\n`;
		const world: World = new Map([['regular_expression:R', regex('R')]]);
		const history = buildHistory({
			files: [parseOpFile(text, '1.manual.sql')],
			commits: new Map(),
			exec: () => world.set('regular_expression:R', regex('R', 'z')),
			extractOne: () => {
				throw new Error('should not be called');
			},
			extractAll: () => structuredClone(world)
		});

		expect(history['regular_expression:R']).toEqual([
			expect.objectContaining({ op: 1, kind: 'created', title: 'Manual' })
		]);
	});

	it('fails when the replayed state disagrees with the compiled state', () => {
		const world: World = new Map();
		const file = parseOpFile(
			`-- @name: Sneaky\n-- --- BEGIN op 1 ( update regular_expression "R" )\nx;\n-- --- END op 1\n`,
			'1.sneaky.sql'
		);
		expect(() =>
			buildHistory({
				files: [file],
				commits: new Map(),
				exec: () => {
					world.set('regular_expression:R', regex('R'));
					world.set('regular_expression:Hidden', regex('Hidden'));
				},
				extractOne: (type, name) =>
					structuredClone(world.get(entityKey(type, name)) ?? null),
				extractAll: () => structuredClone(world)
			})
		).toThrow(/regular_expression:Hidden/);
	});
});
