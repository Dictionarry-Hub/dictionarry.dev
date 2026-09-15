import { describe, expect, it } from 'vitest';
import {
	diffSequences,
	diffText,
	presentChange,
	type PresentContext,
	type SummaryPart
} from '$lib/shared/utils/pcd/history-view';
import type { Condition, EntityChange } from '$lib/types/pcd';

const ctx: PresentContext = {
	database: 'dictionarry',
	exists: (type, name) => name !== 'Missing',
	current: {
		name: '1080p Quality Tier 5',
		conditions: [{ name: 'coffee', type: 'release_group' }]
	}
};

function plain(parts: SummaryPart[]): string {
	return parts.map((part) => part.text).join('');
}

function links(parts: SummaryPart[]): (string | null)[] {
	return parts.filter((part) => part.kind === 'ref').map((part) => part.href);
}

const coffee: Condition = {
	name: 'coffee',
	type: 'release_group',
	arrType: 'all',
	negate: false,
	required: false,
	data: { type: 'release_group', regularExpressionName: 'coffee' }
};

describe('presentChange: conditions', () => {
	it('summarises an added regex condition with a link to the regex', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'conditions[coffee]', kind: 'added', to: coffee },
			ctx
		);

		expect(plain(view!.summary)).toBe('Release Group coffee added');
		expect(links(view!.summary)).toEqual(['/pcd/dictionarry/regular-expressions/coffee']);
		expect(view!.detail).toBeUndefined();
	});

	it('does not link a regex that no longer exists', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'conditions[Missing]',
				kind: 'removed',
				from: {
					...coffee,
					name: 'Missing',
					data: { type: 'release_group', regularExpressionName: 'Missing' }
				}
			},
			ctx
		);

		expect(plain(view!.summary)).toBe('Release Group Missing removed');
		expect(links(view!.summary)).toEqual([null]);
	});

	it('notes flags, arr scope and a differing condition name', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'conditions[Not Extras]',
				kind: 'added',
				to: {
					...coffee,
					name: 'Not Extras',
					arrType: 'radarr',
					negate: true,
					required: true,
					data: { type: 'release_title', regularExpressionName: 'Extras' }
				}
			},
			ctx
		);

		expect(plain(view!.summary)).toBe(
			'Release Group Extras as Not Extras added (negated, required) for Radarr'
		);
	});

	it('describes non-regex conditions by their value', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'conditions[1080p]',
				kind: 'added',
				to: {
					...coffee,
					name: '1080p',
					type: 'resolution',
					data: { type: 'resolution', resolution: '1080p' }
				}
			},
			ctx
		);

		expect(plain(view!.summary)).toBe('Resolution 1080p added');
	});

	it('labels field changes with the condition type from the current entity', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'conditions[coffee].arrType', kind: 'changed', from: 'all', to: 'sonarr' },
			ctx
		);

		expect(plain(view!.summary)).toBe('Release Group coffee now applies to Sonarr');
	});

	it('falls back to a generic label for conditions that no longer exist', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'conditions[gone].required', kind: 'changed', from: false, to: true },
			ctx
		);

		expect(plain(view!.summary)).toBe('Condition gone now required');
	});

	it('links the new regex when a condition is repointed', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'conditions[coffee].data.regularExpressionName',
				kind: 'changed',
				from: 'coffee',
				to: 'Coffee v2'
			},
			ctx
		);

		expect(plain(view!.summary)).toBe('Release Group coffee now uses Coffee v2');
		expect(links(view!.summary)).toEqual([
			null,
			'/pcd/dictionarry/regular-expressions/coffee-v2'
		]);
	});
});

describe('presentChange: scoring', () => {
	it('formats added, changed and removed scores with the arr', () => {
		const added = presentChange(
			'quality_profile',
			{
				path: 'scoring[DSNP|radarr]',
				kind: 'added',
				to: { customFormatName: 'DSNP', arrType: 'radarr', score: 3000 }
			},
			ctx
		);
		const changed = presentChange(
			'quality_profile',
			{ path: 'scoring[DSNP|sonarr].score', kind: 'changed', from: 3000, to: -2000 },
			ctx
		);
		const removed = presentChange(
			'quality_profile',
			{
				path: 'scoring[DSNP|radarr]',
				kind: 'removed',
				from: { customFormatName: 'DSNP', arrType: 'radarr', score: 3000 }
			},
			ctx
		);

		expect(plain(added!.summary)).toBe('DSNP scored +3,000 for Radarr');
		expect(links(added!.summary)).toEqual(['/pcd/dictionarry/custom-formats/dsnp']);
		expect(plain(changed!.summary)).toBe('DSNP score +3,000 to -2,000 for Sonarr');
		expect(plain(removed!.summary)).toBe('DSNP no longer scored for Radarr');
	});
});

describe('presentChange: other shapes', () => {
	it('gives a pattern change a character diff', () => {
		const view = presentChange(
			'regular_expression',
			{ path: 'pattern', kind: 'changed', from: 'abc', to: 'abXc' },
			ctx
		);

		expect(plain(view!.summary)).toBe('Pattern changed');
		expect(view!.detail).toEqual({
			kind: 'chars',
			segments: [
				{ kind: 'same', text: 'ab' },
				{ kind: 'added', text: 'X' },
				{ kind: 'same', text: 'c' }
			]
		});
	});

	it('links regex101 ids externally', () => {
		const view = presentChange(
			'regular_expression',
			{ path: 'regex101Id', kind: 'changed', from: 'i0Ngyx/1', to: 'i0Ngyx/2' },
			ctx
		);

		expect(plain(view!.summary)).toBe('regex101 link updated to i0Ngyx/2');
		expect(view!.summary.at(-1)).toEqual({
			kind: 'ref',
			text: 'i0Ngyx/2',
			href: 'https://regex101.com/r/i0Ngyx/2',
			external: true
		});
	});

	it('renders an appended description paragraph as one added markdown block', () => {
		const before = 'Matches **3D** tags.\n\n- Word boundaries apply.';
		const view = presentChange(
			'regular_expression',
			{
				path: 'description',
				kind: 'changed',
				from: before,
				to: `${before}\n\n- A year lookbehind.`
			},
			ctx
		);

		expect(view!.detail?.kind).toBe('markdown');
		const blocks = view!.detail?.kind === 'markdown' ? view!.detail.blocks : [];
		expect(blocks.map((block) => block.kind)).toEqual(['same', 'same', 'added']);
		expect(blocks[0].html).toContain('<strong>3D</strong>');
		expect(blocks[2].html).toContain('<li>A year lookbehind.</li>');
	});

	it('highlights words inside an edited markdown paragraph', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'description',
				kind: 'changed',
				from: 'Matches releases from the group list.',
				to: 'Matches releases from the banned group list.'
			},
			ctx
		);

		const blocks = view!.detail?.kind === 'markdown' ? view!.detail.blocks : [];
		expect(blocks.map((block) => block.kind)).toEqual(['changed']);
		expect(blocks[0].html).toContain('<ins>banned </ins>');
	});

	it('diffs long prose by word without giving up', () => {
		const before = 'word '.repeat(3000).trim();
		const segments = diffText(before, `${before} extra`);

		expect(segments.filter((segment) => segment.kind !== 'same')).toEqual([
			{ kind: 'added', text: ' extra' }
		]);
	});

	it('shows a rewritten plain text field as before and after', () => {
		const view = presentChange(
			'sonarr_naming',
			{
				path: 'formats.standardEpisodeFormat',
				kind: 'changed',
				from: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
				to: '{Release Group} {Quality Full} {MediaInfo VideoCodec} [{Custom Formats}]'
			},
			ctx
		);

		expect(view!.detail?.kind).toBe('replace');
	});

	it('shows a lightly edited plain text field as an inline diff', () => {
		const view = presentChange(
			'sonarr_naming',
			{
				path: 'formats.standardEpisodeFormat',
				kind: 'changed',
				from: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
				to: '{Series Title} - S{season:00}E{episode:00} - {Episode CleanTitle}'
			},
			ctx
		);

		expect(view!.detail?.kind).toBe('chars');
	});

	it('shows a rewritten description as rendered before and after', () => {
		const view = presentChange(
			'custom_format',
			{
				path: 'description',
				kind: 'changed',
				from: 'Matches releases from the old group list.',
				to: 'Completely different wording about *tiers*.'
			},
			ctx
		);

		expect(view!.detail?.kind).toBe('markdown-replace');
		expect(view!.detail?.kind === 'markdown-replace' ? view!.detail.afterHtml : '').toContain(
			'<em>tiers</em>'
		);
	});

	it('shows an added description as after only', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'description', kind: 'changed', from: null, to: 'New text' },
			ctx
		);

		expect(view!.detail).toEqual({
			kind: 'markdown-replace',
			beforeHtml: '',
			afterHtml: '<p>New text</p>\n'
		});
	});

	it('reports tags that joined and left', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'tags', kind: 'changed', from: ['A', 'B'], to: ['B', 'C', 'D'] },
			ctx
		);

		expect(plain(view!.summary)).toBe('Tags added C, D; removed A');
		expect(
			view!.summary.filter((part) => part.kind === 'ref').map((part) => part.text)
		).toEqual(['C', 'D', 'A']);
	});

	it('summarises quality entries and positions', () => {
		const added = presentChange(
			'quality_profile',
			{
				path: 'qualities[WEB 1080p]',
				kind: 'added',
				to: {
					position: 2,
					enabled: true,
					upgradeUntil: false,
					quality: null,
					group: { name: 'WEB 1080p', members: ['WEBDL-1080p', 'WEBRip-1080p'] }
				}
			},
			ctx
		);
		const moved = presentChange(
			'quality_profile',
			{ path: 'qualities[Bluray-1080p].position', kind: 'changed', from: 3, to: 5 },
			ctx
		);

		expect(plain(added!.summary)).toBe(
			'Quality group WEB 1080p added (WEBDL-1080p, WEBRip-1080p)'
		);
		expect(plain(moved!.summary)).toBe('Bluray-1080p moved from position 3 to 5');
	});

	it('formats tier sizes with units and the unlimited cap', () => {
		const max = presentChange(
			'radarr_quality_definitions',
			{ path: 'tiers[Bluray-1080p].maxSize', kind: 'changed', from: 400, to: 2000 },
			ctx
		);
		const min = presentChange(
			'sonarr_quality_definitions',
			{ path: 'tiers[HDTV-720p].minSize', kind: 'changed', from: 0, to: 17.1 },
			ctx
		);

		expect(plain(max!.summary)).toBe('Bluray-1080p max size 400 MB/min to Unlimited');
		expect(plain(min!.summary)).toBe('HDTV-720p min size 0 MB/min to 17.1 MB/min');
	});

	it('hides a tier change between two values that both display as unlimited', () => {
		const view = presentChange(
			'radarr_quality_definitions',
			{ path: 'tiers[BR-DISK].maxSize', kind: 'changed', from: 0, to: 2000 },
			ctx
		);

		expect(view).toBeNull();
	});

	it('names both apps for shared scoring rows', () => {
		const view = presentChange(
			'quality_profile',
			{
				path: 'scoring[NF|all]',
				kind: 'removed',
				from: { customFormatName: 'NF', arrType: 'all', score: 1000 }
			},
			ctx
		);

		expect(plain(view!.summary)).toBe('NF no longer scored for Radarr and Sonarr');
	});

	it('reads booleans as enabled or disabled', () => {
		const view = presentChange(
			'custom_format',
			{ path: 'includeInRename', kind: 'changed', from: false, to: true },
			ctx
		);

		expect(plain(view!.summary)).toBe('Include in Rename enabled');
	});

	it('falls back to a YAML line diff for unknown object shapes', () => {
		const change: EntityChange = {
			path: 'languages[English]',
			kind: 'changed',
			from: { name: 'English', type: 'must' },
			to: { name: 'English', type: 'must_not' }
		};
		const view = presentChange('quality_profile', change, ctx);

		expect(plain(view!.summary)).toBe('Language › English changed');
		expect(view!.detail?.kind).toBe('lines');
		expect(view!.detail?.kind === 'lines' ? view!.detail.lines : []).toEqual([
			{ kind: 'same', text: 'name: English' },
			{ kind: 'removed', text: 'type: must' },
			{ kind: 'added', text: 'type: must_not' }
		]);
	});
});

describe('diffSequences', () => {
	it('keeps one segment per line in line mode', () => {
		expect(diffSequences(['a', 'b', 'c'], ['a', 'c', 'd'])).toEqual([
			{ kind: 'same', text: 'a' },
			{ kind: 'removed', text: 'b' },
			{ kind: 'same', text: 'c' },
			{ kind: 'added', text: 'd' }
		]);
	});

	it('merges runs in char mode', () => {
		expect(diffSequences([...'hello'], [...'help'], 'chars')).toEqual([
			{ kind: 'same', text: 'hel' },
			{ kind: 'removed', text: 'lo' },
			{ kind: 'added', text: 'p' }
		]);
	});
});
