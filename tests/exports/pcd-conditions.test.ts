import { describe, expect, it } from 'vitest';
import { customFormatToMarkdown } from '$lib/shared/utils/llm/pcd';
import { sortConditions } from '$lib/shared/utils/pcd/conditions';
import { formatConditionValue } from '$lib/shared/utils/pcd/format';
import { customFormatToYaml } from '$lib/shared/utils/yaml/pcd';
import type {
	CompiledDatabase,
	Condition,
	ConditionData,
	ConditionType,
	CustomFormat
} from '$lib/types/pcd';

const mappedValues: [ConditionData, string][] = [
	[{ type: 'source', source: 'unknown' }, 'Unknown'],
	[{ type: 'source', source: 'television' }, 'Television'],
	[{ type: 'source', source: 'television_raw' }, 'Television Raw'],
	[{ type: 'source', source: 'web_dl' }, 'WEB-DL'],
	[{ type: 'source', source: 'webrip' }, 'WEBRip'],
	[{ type: 'source', source: 'dvd' }, 'DVD'],
	[{ type: 'source', source: 'bluray' }, 'Bluray'],
	[{ type: 'source', source: 'bluray_raw' }, 'Bluray Raw'],
	[{ type: 'source', source: 'cam' }, 'CAM'],
	[{ type: 'source', source: 'telesync' }, 'Telesync'],
	[{ type: 'source', source: 'telecine' }, 'Telecine'],
	[{ type: 'source', source: 'workprint' }, 'Workprint'],
	[{ type: 'resolution', resolution: '360p' }, '360p'],
	[{ type: 'resolution', resolution: '480p' }, '480p'],
	[{ type: 'resolution', resolution: '540p' }, '540p'],
	[{ type: 'resolution', resolution: '576p' }, '576p'],
	[{ type: 'resolution', resolution: '720p' }, '720p'],
	[{ type: 'resolution', resolution: '1080p' }, '1080p'],
	[{ type: 'resolution', resolution: '2160p' }, '2160p'],
	[{ type: 'quality_modifier', qualityModifier: 'none' }, 'None'],
	[{ type: 'quality_modifier', qualityModifier: 'regional' }, 'Regional'],
	[{ type: 'quality_modifier', qualityModifier: 'screener' }, 'Screener'],
	[{ type: 'quality_modifier', qualityModifier: 'rawhd' }, 'RawHD'],
	[{ type: 'quality_modifier', qualityModifier: 'brdisk' }, 'BRDISK'],
	[{ type: 'quality_modifier', qualityModifier: 'remux' }, 'REMUX'],
	[{ type: 'release_type', releaseType: 'single_episode' }, 'Single Episode'],
	[{ type: 'release_type', releaseType: 'multi_episode' }, 'Multi Episode'],
	[{ type: 'release_type', releaseType: 'season_pack' }, 'Season Pack'],
	[{ type: 'indexer_flag', flag: 'freeleech' }, 'Freeleech'],
	[{ type: 'indexer_flag', flag: 'halfleech' }, 'Halfleech'],
	[{ type: 'indexer_flag', flag: 'double_upload' }, 'Double Upload'],
	[{ type: 'indexer_flag', flag: 'internal' }, 'Internal'],
	[{ type: 'indexer_flag', flag: 'scene' }, 'Scene'],
	[{ type: 'indexer_flag', flag: 'freeleech_75' }, 'Freeleech 75%'],
	[{ type: 'indexer_flag', flag: 'freeleech_25' }, 'Freeleech 25%'],
	[{ type: 'indexer_flag', flag: 'nuked' }, 'Nuked'],
	[{ type: 'indexer_flag', flag: 'ptp_golden' }, 'PTP Golden'],
	[{ type: 'indexer_flag', flag: 'ptp_approved' }, 'PTP Approved']
];

describe('formatConditionValue', () => {
	it.each(mappedValues)('formats $0 as $1', (data, expected) => {
		expect(formatConditionValue(data)).toBe(expected);
	});

	it('formats patterns and languages', () => {
		expect(
			formatConditionValue({ type: 'release_title', regularExpressionName: 'Golden Rule' })
		).toBe('Golden Rule');
		expect(
			formatConditionValue({
				type: 'language',
				languageName: 'English',
				exceptLanguage: false
			})
		).toBe('English');
		expect(
			formatConditionValue({
				type: 'language',
				languageName: 'English',
				exceptLanguage: true
			})
		).toBe('Except English');
	});

	it.each([
		[{ type: 'size', minBytes: null, maxBytes: null }, 'Any size'],
		[{ type: 'size', minBytes: 1610612736, maxBytes: null }, 'At least 1.5 GB'],
		[{ type: 'size', minBytes: null, maxBytes: 2147483648 }, 'At most 2 GB'],
		[{ type: 'size', minBytes: 1073741824, maxBytes: 2684354560 }, '1 GB to 2.5 GB']
	] satisfies [ConditionData, string][])('formats size bounds', (data, expected) => {
		expect(formatConditionValue(data)).toBe(expected);
	});

	it.each([
		[{ type: 'year', minYear: null, maxYear: null }, 'Any year'],
		[{ type: 'year', minYear: 2000, maxYear: null }, '2000 or later'],
		[{ type: 'year', minYear: null, maxYear: 1999 }, '1999 or earlier'],
		[{ type: 'year', minYear: 1980, maxYear: 1989 }, '1980 to 1989']
	] satisfies [ConditionData, string][])('formats year bounds', (data, expected) => {
		expect(formatConditionValue(data)).toBe(expected);
	});

	it('preserves unknown values', () => {
		expect(formatConditionValue({ type: 'source', source: 'future_source' })).toBe(
			'future_source'
		);
	});
});

interface SortableCondition {
	id: number;
	name: string;
	type: string;
	required: boolean;
	negate: boolean;
}

describe('sortConditions', () => {
	it('sorts by status, type, and name without mutating the input', () => {
		const conditions: SortableCondition[] = [
			{ id: 1, name: 'Zulu', type: 'release_title', required: false, negate: false },
			{ id: 2, name: 'Source', type: 'source', required: true, negate: false },
			{ id: 3, name: 'Alpha', type: 'release_title', required: true, negate: false },
			{ id: 4, name: 'Resolution', type: 'resolution', required: true, negate: false },
			{ id: 5, name: 'Negated', type: 'resolution', required: true, negate: true },
			{ id: 6, name: 'Unknown', type: 'future_type', required: false, negate: false }
		];
		const originalOrder = conditions.map((condition) => condition.id);

		expect(sortConditions(conditions).map((condition) => condition.id)).toEqual([
			4, 2, 3, 5, 1, 6
		]);
		expect(conditions.map((condition) => condition.id)).toEqual(originalOrder);
	});

	it('retains source order for exact ties', () => {
		const conditions: SortableCondition[] = [
			{ id: 1, name: 'Same', type: 'source', required: true, negate: false },
			{ id: 2, name: 'Same', type: 'source', required: true, negate: false }
		];

		expect(sortConditions(conditions).map((condition) => condition.id)).toEqual([1, 2]);
	});
});

function condition(
	name: string,
	type: ConditionType,
	required: boolean,
	negate: boolean,
	data: ConditionData
): Condition {
	return { name, type, arrType: 'all', required, negate, data };
}

function customFormat(conditions: Condition[]): CustomFormat {
	return {
		name: 'Example',
		description: null,
		includeInRename: false,
		tags: [],
		conditions,
		tests: []
	};
}

const database: CompiledDatabase = {
	id: 'example',
	name: 'Example',
	repo: 'example/database',
	branch: 'main',
	version: '1.0.0',
	schemaVersion: '1.0.0',
	description: '',
	arrTypes: ['radarr', 'sonarr'],
	customFormats: [],
	qualityProfiles: [],
	regularExpressions: [],
	delayProfiles: [],
	media: {
		radarr: { naming: [], settings: [], qualityDefinitions: [] },
		sonarr: { naming: [], settings: [], qualityDefinitions: [] }
	}
};

describe('custom format serializers', () => {
	it('sorts conditions while keeping YAML values raw', () => {
		const format = customFormat([
			condition('Optional source', 'source', false, false, {
				type: 'source',
				source: 'web_dl'
			}),
			condition('Required resolution', 'resolution', true, false, {
				type: 'resolution',
				resolution: '1080p'
			}),
			condition('Negated title', 'release_title', false, true, {
				type: 'release_title',
				regularExpressionName: 'Blocked'
			})
		]);

		const markdown = customFormatToMarkdown(database, format);
		const yaml = customFormatToYaml(database, format);

		expect(markdown.indexOf('### Required resolution')).toBeLessThan(
			markdown.indexOf('### Negated title')
		);
		expect(markdown.indexOf('### Negated title')).toBeLessThan(
			markdown.indexOf('### Optional source')
		);
		expect(markdown).toContain('- **Value:** WEB-DL');

		expect(yaml.indexOf('name: Required resolution')).toBeLessThan(
			yaml.indexOf('name: Negated title')
		);
		expect(yaml.indexOf('name: Negated title')).toBeLessThan(
			yaml.indexOf('name: Optional source')
		);
		expect(yaml).toContain('source: web_dl');
		expect(yaml).not.toContain('source: WEB-DL');
	});
});
