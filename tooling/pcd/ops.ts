// Op file parser. A PCD repo's ops/ folder is an append-only log of SQL
// files. The first file is a bulk import with no markers. Every later file is
// a Profilarr export batch with a header:
//
//   -- @name: Tweak Edition Regex
//   -- @exportedAt: 2026-03-22T23:34:47.016Z
//   -- @opIds: 3587, 3588
//
// and each op wrapped in markers naming the entity it touches:
//
//   -- --- BEGIN op 3587 ( update regular_expression "Special Edition" )
//   update "regular_expressions" set ... where "name" = 'Special Edition';
//   -- --- END op 3587
//
// The exporter writes the name unescaped and may omit the label entirely, so
// parsing is tolerant: the label is optional and the name is greedy to the
// closing quote. Pure module; reading files is the caller's job.

export type OpVerb = 'create' | 'update' | 'delete';

export interface ParsedOp {
	id: number;
	verb: OpVerb;
	entityType: string;
	name: string;
	sql: string;
	/**
	 * Other names of the same entity type the SQL refers to, e.g. the old name
	 * in a rename's WHERE clause. Renames show up as one of these going away
	 * while the op's own name appears.
	 */
	mentions: string[];
}

export interface ParsedOpFile {
	file: string;
	/** Numeric filename prefix; replay order. */
	number: number;
	/** Batch title from the header, if any. */
	title: string | null;
	/** Export or generation timestamp from the header, if any. */
	exportedAt: string | null;
	/** Full file contents, executed as one statement batch. */
	text: string;
	ops: ParsedOp[];
	/** True when at least one op has no label, so the touched set is unknown. */
	touchedUnknown: boolean;
}

/** Entity types that appear in ops but are not extracted by the site. */
export const IGNORED_ENTITY_TYPES: ReadonlySet<string> = new Set(['test_entity', 'test_release']);

const BEGIN = /^-- --- BEGIN op (\d+)(?: \( (\w+) (\w+) "(.*)" \))?\s*$/;
const END = /^-- --- END op (\d+)\s*$/;
const HEADER = /^-- @(\w+): (.*)$/;
const GENERATED = /^-- Generated(?: at)?: (\S+)/m;
// A bare `name` column reference (not quality_profile_name etc.) compared to
// a string literal.
const NAME_REF = /(?<![\w"])"?name"?\s*=\s*'((?:[^']|'')*)'/g;

export function parseOpFile(text: string, file: string): ParsedOpFile {
	const headers: Record<string, string> = {};
	const ops: ParsedOp[] = [];
	let touchedUnknown = false;

	let current: { id: number; verb: OpVerb; entityType: string; name: string } | null = null;
	let body: string[] = [];

	for (const rawLine of text.split('\n')) {
		const line = rawLine.replace(/\r$/, '');

		if (current === null) {
			const header = line.match(HEADER);
			if (header) {
				headers[header[1]] = header[2].trim();
				continue;
			}
			const begin = line.match(BEGIN);
			if (begin) {
				const [, id, verb, entityType, name] = begin;
				if (verb === undefined) {
					touchedUnknown = true;
					current = { id: Number(id), verb: 'update', entityType: '', name: '' };
				} else {
					current = { id: Number(id), verb: verb as OpVerb, entityType, name };
				}
				body = [];
			}
			continue;
		}

		const end = line.match(END);
		if (end && Number(end[1]) === current.id) {
			if (current.entityType !== '') {
				const sql = body.join('\n').trim();
				ops.push({ ...current, sql, mentions: mentionedNames(sql, current.name) });
			}
			current = null;
			body = [];
			continue;
		}

		body.push(line);
	}

	// Unterminated op: treat as unlabeled so the file falls back to a full diff.
	if (current !== null) touchedUnknown = true;

	return {
		file,
		number: fileNumber(file),
		title: headers.name ?? null,
		exportedAt: headers.exportedAt ?? text.match(GENERATED)?.[1] ?? null,
		text,
		ops,
		touchedUnknown
	};
}

export function fileNumber(file: string): number {
	return parseInt(file.match(/^(\d+)/)?.[1] ?? '0', 10);
}

function mentionedNames(sql: string, own: string): string[] {
	const names = new Set<string>();
	for (const match of sql.matchAll(NAME_REF)) {
		const name = unescapeSql(match[1]);
		if (name !== own) names.add(name);
	}
	return [...names];
}

function unescapeSql(value: string): string {
	return value.replace(/''/g, "'");
}
