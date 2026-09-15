import { describe, expect, it } from 'vitest';
import { diffEntities, itemKey } from '../../tooling/pcd/diff.js';
import type { CustomFormat, QualityProfile } from '../../src/lib/types/pcd.js';

function customFormat(overrides: Partial<CustomFormat> = {}): CustomFormat {
	return {
		name: 'Extras',
		description: null,
		includeInRename: false,
		tags: ['Banned'],
		conditions: [
			{
				name: 'Extras',
				type: 'release_title',
				arrType: 'all',
				negate: false,
				required: false,
				data: { type: 'release_title', regularExpressionName: 'Extras' }
			}
		],
		tests: [],
		...overrides
	};
}

function profile(overrides: Partial<QualityProfile> = {}): QualityProfile {
	return {
		name: '1080p Balanced',
		description: null,
		tags: [],
		upgradesAllowed: true,
		minimumCustomFormatScore: 0,
		upgradeUntilScore: 10000,
		upgradeScoreIncrement: 1,
		languages: [],
		qualities: [
			{
				position: 0,
				enabled: true,
				upgradeUntil: false,
				quality: 'Bluray-1080p',
				group: null
			},
			{
				position: 1,
				enabled: true,
				upgradeUntil: true,
				quality: null,
				group: { name: 'WEB 1080p', members: ['WEBDL-1080p', 'WEBRip-1080p'] }
			}
		],
		scoring: [
			{ customFormatName: 'DSNP', arrType: 'radarr', score: 3000 },
			{ customFormatName: 'DSNP', arrType: 'sonarr', score: 2000 }
		],
		...overrides
	};
}

describe('diffEntities', () => {
	it('returns no changes for identical input regardless of key order', () => {
		const a = { name: 'x', description: null, tags: ['a'] };
		const b = { tags: ['a'], description: null, name: 'x' };

		expect(diffEntities(a, b)).toEqual([]);
	});

	it('reports a scalar change with before and after', () => {
		const changes = diffEntities(customFormat(), customFormat({ includeInRename: true }));

		expect(changes).toEqual([
			{ path: 'includeInRename', kind: 'changed', from: false, to: true }
		]);
	});

	it('treats null as a value, not an absence', () => {
		expect(diffEntities(customFormat(), customFormat({ description: 'Hi' }))).toEqual([
			{ path: 'description', kind: 'changed', from: null, to: 'Hi' }
		]);
	});

	it('matches conditions by name and reports nested field changes', () => {
		const after = customFormat();
		after.conditions[0].negate = true;
		after.conditions[0].data = { type: 'release_title', regularExpressionName: 'Movie Extras' };

		expect(diffEntities(customFormat(), after)).toEqual([
			{
				path: 'conditions[Extras].data.regularExpressionName',
				kind: 'changed',
				from: 'Extras',
				to: 'Movie Extras'
			},
			{ path: 'conditions[Extras].negate', kind: 'changed', from: false, to: true }
		]);
	});

	it('reports added and removed keyed items whole', () => {
		const before = customFormat();
		const after = customFormat({
			conditions: [
				{
					name: 'Sample',
					type: 'release_title',
					arrType: 'all',
					negate: false,
					required: false,
					data: { type: 'release_title', regularExpressionName: 'Sample' }
				}
			]
		});

		const changes = diffEntities(before, after);

		expect(changes).toHaveLength(2);
		expect(changes).toContainEqual({
			path: 'conditions[Extras]',
			kind: 'removed',
			from: before.conditions[0]
		});
		expect(changes).toContainEqual({
			path: 'conditions[Sample]',
			kind: 'added',
			to: after.conditions[0]
		});
	});

	it('keys scoring rows by custom format and arr type', () => {
		const after = profile();
		after.scoring[1] = { customFormatName: 'DSNP', arrType: 'sonarr', score: 2500 };

		expect(diffEntities(profile(), after)).toEqual([
			{ path: 'scoring[DSNP|sonarr].score', kind: 'changed', from: 2000, to: 2500 }
		]);
	});

	it('keys quality entries by quality or group name', () => {
		const after = profile();
		after.qualities[1] = {
			...after.qualities[1],
			group: { name: 'WEB 1080p', members: ['WEBRip-1080p', 'WEBDL-1080p'] }
		};

		expect(diffEntities(profile(), after)).toEqual([
			{
				path: 'qualities[WEB 1080p].group.members',
				kind: 'changed',
				from: ['WEBDL-1080p', 'WEBRip-1080p'],
				to: ['WEBRip-1080p', 'WEBDL-1080p']
			}
		]);
	});

	it('compares primitive arrays whole', () => {
		expect(diffEntities(customFormat(), customFormat({ tags: ['Banned', 'Audio'] }))).toEqual([
			{ path: 'tags', kind: 'changed', from: ['Banned'], to: ['Banned', 'Audio'] }
		]);
	});

	it('falls out of keyed matching when a condition changes type', () => {
		const after = customFormat();
		after.conditions[0] = {
			...after.conditions[0],
			type: 'size',
			data: { type: 'size', minBytes: 1, maxBytes: null }
		};

		const paths = diffEntities(customFormat(), after).map((c) => `${c.kind} ${c.path}`);

		expect(paths).toEqual([
			'added conditions[Extras].data.maxBytes',
			'added conditions[Extras].data.minBytes',
			'removed conditions[Extras].data.regularExpressionName',
			'changed conditions[Extras].data.type',
			'changed conditions[Extras].type'
		]);
	});
});

describe('itemKey', () => {
	it('derives keys for every keyed shape', () => {
		expect(itemKey({ customFormatName: 'A', arrType: 'radarr', score: 1 })).toBe('A|radarr');
		expect(itemKey({ qualityName: 'Bluray-1080p', minSize: 0 })).toBe('Bluray-1080p');
		expect(itemKey({ title: 'T', type: 'x' })).toBe('T');
		expect(itemKey({ position: 3, quality: 'HDTV-720p', group: null })).toBe('HDTV-720p');
		expect(itemKey({ position: 3, quality: null, group: { name: 'G', members: [] } })).toBe(
			'G'
		);
		expect(itemKey({ position: 3, quality: null, group: null })).toBe('#3');
		expect(itemKey({ name: 'N', type: 'x' })).toBe('N');
		expect(itemKey({ foo: 1 })).toBeNull();
		expect(itemKey('string')).toBeNull();
	});
});
