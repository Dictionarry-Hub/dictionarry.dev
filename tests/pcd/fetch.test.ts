import { describe, expect, it } from 'vitest';
import { parseOpFileCommits } from '../../tooling/pcd/fetch.js';

// Output of: git log --format=%x01%H%x00%aI%x00%s --name-only --no-renames --diff-filter=A -- ops
const log = [
	'\x01bbb\x002026-09-08T20:25:43+00:00\x00ADD Friday\n\nops/348.add-friday.sql\n',
	'\x01aaa\x002026-03-22T23:34:48+00:00\x00Tweak Edition Regex\n\nops/110.tweak-edition-regex.sql\nops/README.md\n',
	'\x01000\x002026-01-31T00:20:00+00:00\x00Initial\n\nops/0.rosettarr.sql\nops/110.tweak-edition-regex.sql\n'
].join('\n');

describe('parseOpFileCommits', () => {
	it('maps each op file to its commit', () => {
		const commits = parseOpFileCommits(log);

		expect(commits.get('348.add-friday.sql')).toEqual({
			hash: 'bbb',
			date: '2026-09-08T20:25:43+00:00',
			message: 'ADD Friday'
		});
		expect(commits.get('0.rosettarr.sql')?.hash).toBe('000');
	});

	it('keeps the newest commit when a file was added more than once', () => {
		expect(parseOpFileCommits(log).get('110.tweak-edition-regex.sql')?.hash).toBe('aaa');
	});

	it('ignores non-sql paths', () => {
		expect(parseOpFileCommits(log).has('README.md')).toBe(false);
	});
});
