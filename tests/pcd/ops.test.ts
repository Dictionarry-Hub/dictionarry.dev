import { describe, expect, it } from 'vitest';
import { fileNumber, parseOpFile } from '../../tooling/pcd/ops.js';

const batch = `-- @operation: export
-- @entity: batch
-- @name: Tweak Edition Regex
-- @exportedAt: 2026-03-22T23:34:47.016Z
-- @opIds: 3587, 3588

-- --- BEGIN op 3587 ( update regular_expression "Special Edition" )
update "regular_expressions" set "pattern" = 'b' where "name" = 'Special Edition' and "pattern" = 'a';
-- --- END op 3587

-- --- BEGIN op 3588 ( create custom_format "Quote "Me" (v2)" )
insert into "custom_formats" ("name") values ('Quote "Me" (v2)');
-- --- END op 3588
`;

describe('parseOpFile', () => {
	it('reads the batch header', () => {
		const parsed = parseOpFile(batch, '110.tweak-edition-regex.sql');

		expect(parsed.number).toBe(110);
		expect(parsed.title).toBe('Tweak Edition Regex');
		expect(parsed.exportedAt).toBe('2026-03-22T23:34:47.016Z');
		expect(parsed.text).toBe(batch);
		expect(parsed.touchedUnknown).toBe(false);
	});

	it('parses each labeled op with its verb, type, name and body', () => {
		const { ops } = parseOpFile(batch, '110.tweak-edition-regex.sql');

		expect(ops).toHaveLength(2);
		expect(ops[0]).toMatchObject({
			id: 3587,
			verb: 'update',
			entityType: 'regular_expression',
			name: 'Special Edition'
		});
		expect(ops[0].sql).toContain('update "regular_expressions"');
		expect(ops[0].sql).not.toContain('BEGIN op');
	});

	it('keeps quotes and parentheses inside names', () => {
		const { ops } = parseOpFile(batch, '110.tweak-edition-regex.sql');

		expect(ops[1].name).toBe('Quote "Me" (v2)');
	});

	it('collects other same-table names the SQL mentions, unescaping quotes', () => {
		const text = `-- @name: Rename
-- --- BEGIN op 1 ( update custom_format "O'Brien" )
update "custom_formats" set "name" = 'O''Brien', "description" = 'x' where "name" = 'Old';
-- --- END op 1
-- --- BEGIN op 2 ( update quality_profile "P" )
update quality_profile_custom_formats set score = 1 where quality_profile_name = 'P' and custom_format_name = 'C' and name = 'P';
-- --- END op 2
`;
		const { ops } = parseOpFile(text, '5.rename.sql');

		expect(ops[0].name).toBe("O'Brien");
		expect(ops[0].mentions).toEqual(['Old']);
		// Column references like custom_format_name are not bare name columns,
		// and the op's own name is excluded.
		expect(ops[1].mentions).toEqual([]);
	});

	it('treats a file without markers as an unknown touched set', () => {
		const text = `-- PCD 2.0 Initial Import
-- Generated at: 2026-01-31T00:15:41.102Z
INSERT INTO tags (name) VALUES ('1080p');
`;
		const parsed = parseOpFile(text, '0.rosettarr.sql');

		expect(parsed.ops).toEqual([]);
		expect(parsed.title).toBeNull();
		expect(parsed.exportedAt).toBe('2026-01-31T00:15:41.102Z');
	});

	it('flags a file with an unlabeled op', () => {
		const text = `-- @name: Manual
-- --- BEGIN op 9
delete from "tags" where "name" = 'x';
-- --- END op 9
-- --- BEGIN op 10 ( delete regular_expression "R" )
delete from "regular_expressions" where "name" = 'R';
-- --- END op 10
`;
		const parsed = parseOpFile(text, '3.manual.sql');

		expect(parsed.touchedUnknown).toBe(true);
		expect(parsed.ops.map((op) => op.id)).toEqual([10]);
	});

	it('flags an unterminated op', () => {
		const text = `-- --- BEGIN op 1 ( update custom_format "A" )
update "custom_formats" set "description" = 'x' where "name" = 'A';
`;
		expect(parseOpFile(text, '2.broken.sql').touchedUnknown).toBe(true);
	});

	it('accepts CRLF line endings', () => {
		const { ops } = parseOpFile(batch.replace(/\n/g, '\r\n'), '110.x.sql');

		expect(ops).toHaveLength(2);
		expect(ops[0].sql).not.toContain('\r');
	});
});

describe('fileNumber', () => {
	it('reads the numeric prefix and sorts numerically', () => {
		const files = ['10.b.sql', '2.a.sql', '100.c.sql'].sort(
			(a, b) => fileNumber(a) - fileNumber(b)
		);

		expect(files).toEqual(['2.a.sql', '10.b.sql', '100.c.sql']);
	});
});
