import { describe, expect, it } from 'vitest';
import {
	buildCustomFormatEntry,
	buildDelayProfileEntry,
	buildMediaSettingsEntry,
	buildNamingEntry,
	buildPcdEntries,
	buildQualityDefinitionsEntry,
	buildQualityProfileEntry,
	buildRegularExpressionEntry
} from '$lib/shared/utils/search/pcd';
import type {
	CompiledDatabase,
	CustomFormat,
	DelayProfile,
	MediaSettings,
	NamingConfig,
	QualityDefinitionConfig,
	QualityProfile,
	RegularExpression
} from '$lib/types/pcd';

function qualityProfile(overrides: Partial<QualityProfile> = {}): QualityProfile {
	return {
		name: '1080p Encode',
		description: null,
		tags: [],
		upgradesAllowed: true,
		minimumCustomFormatScore: 0,
		upgradeUntilScore: 10000,
		upgradeScoreIncrement: 1,
		languages: [],
		qualities: [],
		scoring: [],
		...overrides
	};
}

function customFormat(overrides: Partial<CustomFormat> = {}): CustomFormat {
	return {
		name: 'x265 (HD)',
		description: null,
		includeInRename: false,
		tags: [],
		conditions: [],
		tests: [],
		...overrides
	};
}

function regularExpression(overrides: Partial<RegularExpression> = {}): RegularExpression {
	return {
		name: 'x265 HD',
		pattern: '\\bx265\\b',
		description: null,
		regex101Id: null,
		tags: [],
		...overrides
	};
}

function delayProfile(overrides: Partial<DelayProfile> = {}): DelayProfile {
	return {
		name: 'Prefer Usenet',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: null,
		torrentDelay: null,
		bypassIfHighestQuality: false,
		bypassIfAboveCustomFormatScore: false,
		minimumCustomFormatScore: null,
		...overrides
	};
}

function naming(overrides: Partial<NamingConfig> = {}): NamingConfig {
	return {
		name: 'Default',
		arrType: 'radarr',
		rename: true,
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: null,
		formats: {},
		...overrides
	};
}

function mediaSettings(overrides: Partial<MediaSettings> = {}): MediaSettings {
	return {
		name: 'Default',
		propersRepacks: 'doNotPrefer',
		enableMediaInfo: true,
		...overrides
	};
}

function qualityDefinitions(
	overrides: Partial<QualityDefinitionConfig> = {}
): QualityDefinitionConfig {
	return {
		name: 'Default',
		tiers: [
			{ qualityName: 'SDTV', minSize: 2, maxSize: 100, preferredSize: 95 },
			{ qualityName: 'WEBDL-1080p', minSize: 4, maxSize: 100, preferredSize: 95 },
			{ qualityName: 'Remux-2160p', minSize: 35, maxSize: 400, preferredSize: 95 }
		],
		...overrides
	};
}

describe('buildQualityProfileEntry', () => {
	it('uses the description as the blurb, stripped to plain text', () => {
		const entry = buildQualityProfileEntry(
			qualityProfile({
				description:
					'**Balanced** 1080p encodes. See [the guide](https://example.com) for details.\n\nSecond paragraph ignored.'
			}),
			'dictionarry'
		);

		expect(entry.title).toBe('1080p Encode');
		expect(entry.url).toBe('/pcd/dictionarry/quality-profiles/1080p-encode');
		expect(entry.type).toBe('quality-profile');
		expect(entry.blurb).toBe('Balanced 1080p encodes. See the guide for details.');
		expect(entry.elo).toBe(1500);
	});

	it('truncates long descriptions at a word boundary', () => {
		const entry = buildQualityProfileEntry(
			qualityProfile({ description: `${'word '.repeat(40)}end` }),
			'dictionarry'
		);

		expect(entry.blurb).toBe(`${'word '.repeat(31)}word...`);
	});

	it('falls back to the upgrade target when description is null', () => {
		const entry = buildQualityProfileEntry(
			qualityProfile({
				qualities: [
					{
						position: 1,
						enabled: true,
						upgradeUntil: false,
						quality: 'WEBDL-1080p',
						group: null
					},
					{
						position: 2,
						enabled: true,
						upgradeUntil: true,
						quality: null,
						group: {
							name: 'Bluray-1080p',
							members: ['Bluray-1080p', 'Bluray-1080p Remux']
						}
					}
				]
			}),
			'dictionarry'
		);

		expect(entry.blurb).toBe('Upgrades until Bluray-1080p.');
	});

	it('routes tags and enabled quality names to keywords, deduped', () => {
		const entry = buildQualityProfileEntry(
			qualityProfile({
				tags: ['hd', 'encode'],
				qualities: [
					{
						position: 1,
						enabled: true,
						upgradeUntil: false,
						quality: 'WEBDL-1080p',
						group: null
					},
					{
						position: 2,
						enabled: true,
						upgradeUntil: true,
						quality: null,
						group: {
							name: 'Bluray-1080p',
							members: ['Bluray-1080p', 'Bluray-1080p Remux']
						}
					},
					{
						position: 3,
						enabled: false,
						upgradeUntil: false,
						quality: 'CAM',
						group: null
					}
				]
			}),
			'dictionarry'
		);

		expect(entry.keywords).toEqual([
			'hd',
			'encode',
			'WEBDL-1080p',
			'Bluray-1080p',
			'Bluray-1080p Remux',
			'quality profile'
		]);
	});
});

describe('buildCustomFormatEntry', () => {
	it('summarizes condition types when description is null', () => {
		const entry = buildCustomFormatEntry(
			customFormat({
				tags: ['codec'],
				conditions: [
					{
						name: 'x265',
						type: 'release_title',
						arrType: 'radarr',
						negate: false,
						required: true,
						data: { type: 'release_title', regularExpressionName: 'x265 HD' }
					},
					{
						name: 'hevc',
						type: 'release_title',
						arrType: 'radarr',
						negate: false,
						required: false,
						data: { type: 'release_title', regularExpressionName: 'HEVC' }
					},
					{
						name: '1080p',
						type: 'resolution',
						arrType: 'radarr',
						negate: false,
						required: true,
						data: { type: 'resolution', resolution: '1080p' }
					}
				]
			}),
			'dictionarry'
		);

		expect(entry.url).toBe('/pcd/dictionarry/custom-formats/x265-hd');
		expect(entry.blurb).toBe('3 conditions: release title, resolution.');
		expect(entry.keywords).toEqual(['codec', 'custom format']);
	});

	it('uses the description when present', () => {
		const entry = buildCustomFormatEntry(
			customFormat({ description: 'Matches x265/HEVC releases.' }),
			'dictionarry'
		);

		expect(entry.blurb).toBe('Matches x265/HEVC releases.');
	});
});

describe('buildRegularExpressionEntry', () => {
	it('falls back to the truncated pattern when description is null', () => {
		const entry = buildRegularExpressionEntry(
			regularExpression({ pattern: '\\b(x265|HEVC)\\b' }),
			'dictionarry'
		);

		expect(entry.url).toBe('/pcd/dictionarry/regular-expressions/x265-hd');
		expect(entry.blurb).toBe('Pattern: \\b(x265|HEVC)\\b');
	});

	it('uses the description when present', () => {
		const entry = buildRegularExpressionEntry(
			regularExpression({ description: 'Matches x265 and HEVC.' }),
			'dictionarry'
		);

		expect(entry.blurb).toBe('Matches x265 and HEVC.');
	});

	it('replaces a dangling colon when the first paragraph introduces a list', () => {
		const entry = buildRegularExpressionEntry(
			regularExpression({
				description: 'Matches the release group only if it is:\n\n- a WEB-DL\n- not banned'
			}),
			'dictionarry'
		);

		expect(entry.blurb).toBe('Matches the release group only if it is...');
	});
});

describe('buildDelayProfileEntry', () => {
	it('derives the blurb from protocol, delays, and bypasses', () => {
		const entry = buildDelayProfileEntry(
			delayProfile({
				torrentDelay: 120,
				bypassIfHighestQuality: true
			}),
			'dictionarry'
		);

		expect(entry.url).toBe('/pcd/dictionarry/delay-profiles/prefer-usenet');
		expect(entry.blurb).toBe(
			'Prefers usenet. 120 min torrent delay. Bypasses at highest quality.'
		);
	});

	it('includes the score bypass when configured', () => {
		const entry = buildDelayProfileEntry(
			delayProfile({
				bypassIfAboveCustomFormatScore: true,
				minimumCustomFormatScore: 100
			}),
			'dictionarry'
		);

		expect(entry.blurb).toBe('Prefers usenet. Bypasses above score 100.');
	});
});

describe('buildNamingEntry', () => {
	it('derives the blurb and routes the arr type to keywords', () => {
		const entry = buildNamingEntry(naming({ arrType: 'sonarr', rename: false }), 'dictionarry');

		expect(entry.url).toBe('/pcd/dictionarry/naming/sonarr/default');
		expect(entry.blurb).toBe('Sonarr naming scheme, renaming disabled.');
		expect(entry.keywords).toEqual(['sonarr', 'naming']);
	});
});

describe('buildMediaSettingsEntry', () => {
	it('humanizes propers/repacks and reports MediaInfo state', () => {
		const entry = buildMediaSettingsEntry(mediaSettings(), 'sonarr', 'dictionarry');

		expect(entry.url).toBe('/pcd/dictionarry/media-settings/sonarr/default');
		expect(entry.blurb).toBe('Propers/repacks: do not prefer. MediaInfo enabled.');
		expect(entry.keywords).toEqual(['sonarr', 'media settings']);
	});
});

describe('buildQualityDefinitionsEntry', () => {
	it('derives the blurb from the tier count and range', () => {
		const entry = buildQualityDefinitionsEntry(qualityDefinitions(), 'radarr', 'dictionarry');

		expect(entry.url).toBe('/pcd/dictionarry/quality-definitions/radarr/default');
		expect(entry.blurb).toBe('3 quality tiers, SDTV to Remux-2160p.');
		expect(entry.keywords).toEqual(['radarr', 'quality definitions']);
	});
});

describe('buildPcdEntries', () => {
	it('builds entries for every entity across all seven types', () => {
		const database: CompiledDatabase = {
			id: 'dictionarry',
			name: 'Dictionarry',
			repo: 'example/database',
			branch: 'main',
			version: '1.0.0',
			schemaVersion: '1.0.0',
			description: 'Test database',
			arrTypes: ['radarr', 'sonarr'],
			customFormats: [customFormat()],
			qualityProfiles: [qualityProfile()],
			regularExpressions: [regularExpression()],
			delayProfiles: [delayProfile()],
			media: {
				radarr: {
					naming: [naming()],
					settings: [mediaSettings()],
					qualityDefinitions: [qualityDefinitions()]
				},
				sonarr: {
					naming: [naming({ arrType: 'sonarr' })],
					settings: [],
					qualityDefinitions: []
				}
			}
		};

		const entries = buildPcdEntries(database);

		expect(entries).toHaveLength(8);
		expect(entries.map((e) => e.url)).toEqual([
			'/pcd/dictionarry/quality-profiles/1080p-encode',
			'/pcd/dictionarry/custom-formats/x265-hd',
			'/pcd/dictionarry/regular-expressions/x265-hd',
			'/pcd/dictionarry/delay-profiles/prefer-usenet',
			'/pcd/dictionarry/naming/radarr/default',
			'/pcd/dictionarry/media-settings/radarr/default',
			'/pcd/dictionarry/quality-definitions/radarr/default',
			'/pcd/dictionarry/naming/sonarr/default'
		]);
	});
});
