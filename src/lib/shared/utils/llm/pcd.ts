import type {
	CompiledDatabase,
	CustomFormat,
	DelayProfile,
	MediaSettings,
	NamingConfig,
	QualityDefinitionConfig,
	RegularExpression
} from '$lib/types/pcd';
import { slugify } from '$lib/shared/utils/slug';
import { sortConditions } from '$lib/shared/utils/pcd/conditions';
import {
	customFormatProfileReferences,
	formatProfileScore,
	regularExpressionReferences,
	type QualityProfileReference,
	type RegularExpressionReference
} from '$lib/shared/utils/pcd/references';
import {
	NAMING_FORMAT_LABELS,
	COLON_REPLACEMENT_LABELS,
	MULTI_EPISODE_LABELS,
	formatProtocol,
	formatDelay,
	formatPropersRepacks,
	formatTierSize,
	formatTierMaxSize,
	formatConditionType,
	formatConditionArrType,
	formatConditionValue
} from '$lib/shared/utils/pcd/format';
import { formatHistoryKind, type EntityHistoryItem } from '$lib/shared/utils/pcd/history';
import { SITE_URL } from './site.js';
import { join, fence, isoDate } from './md.js';

// Markdown serializers for PCD entity artifacts. PCD entities are structured
// data compiled from PCD repositories, so these are API-style serializers
// consuming the same CompiledDatabase JSON the entity pages render, not
// mdsvex pass-throughs. See docs/backend/llm.md.

export function regexToMarkdown(
	data: CompiledDatabase,
	regex: RegularExpression,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(regex.name);

	const context = [
		`A regular expression from the ${data.name} PCD database.`,
		regex.tags.length > 0 ? `Tags: ${regex.tags.join(', ')}.` : '',
		`Web version: ${SITE_URL}/pcd/${data.id}/regular-expressions/${slug}`
	]
		.filter(Boolean)
		.join(' ');

	const references = regularExpressionReferences(data, regex.name);

	return join([
		`# ${regex.name}`,
		context,
		'## Pattern',
		fence('regex', regex.pattern),
		regex.regex101Id ? `Test this pattern at https://regex101.com/r/${regex.regex101Id}.` : '',
		regex.description ? join(['## Description', regex.description]) : '',
		'## References',
		referencesSection(data.id, references),
		historySection(history)
	]);
}

export function customFormatToMarkdown(
	data: CompiledDatabase,
	format: CustomFormat,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(format.name);
	const context = [
		`A custom format from the ${data.name} PCD database.`,
		format.tags.length > 0 ? `Tags: ${format.tags.join(', ')}.` : '',
		`Web version: ${SITE_URL}/pcd/${data.id}/custom-formats/${slug}`
	]
		.filter(Boolean)
		.join(' ');

	const conditions = sortConditions(format.conditions).map((condition) =>
		join([
			`### ${condition.name}`,
			detailList([
				['Type', formatConditionType(condition.type)],
				['Value', formatConditionValue(condition.data)],
				['Applies To', formatConditionArrType(condition.arrType)],
				['Required', condition.required ? 'Yes' : 'No'],
				['Negated', condition.negate ? 'Yes' : 'No']
			])
		])
	);

	const tests = format.tests.map((test) =>
		join([
			`### ${test.title}`,
			detailList([
				['Type', test.type],
				['Expected to Match', test.shouldMatch ? 'Yes' : 'No']
			]),
			test.description
		])
	);
	const references = customFormatProfileReferences(data, format.name);

	return join([
		`# ${format.name}`,
		context,
		format.description ? join(['## Description', format.description]) : '',
		'## Configuration',
		settingsTable([['Include in Rename', format.includeInRename ? 'Yes' : 'No']]),
		'## Conditions',
		conditions.length > 0 ? conditions.join('\n\n') : 'No conditions.',
		tests.length > 0 ? join(['## Tests', tests.join('\n\n')]) : '',
		'## References',
		qualityProfileReferencesSection(data.id, references),
		historySection(history)
	]);
}

export function delayProfileToMarkdown(
	data: CompiledDatabase,
	profile: DelayProfile,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(profile.name);

	const rows: [string, string][] = [
		['Download Protocol', formatProtocol(profile.preferredProtocol)]
	];
	if (profile.preferredProtocol !== 'only_torrent') {
		rows.push(['Usenet Delay', formatDelay(profile.usenetDelay)]);
	}
	if (profile.preferredProtocol !== 'only_usenet') {
		rows.push(['Torrent Delay', formatDelay(profile.torrentDelay)]);
	}
	rows.push(['Bypass if Highest Quality', profile.bypassIfHighestQuality ? 'Yes' : 'No']);
	rows.push([
		'Bypass if Above Custom Format Score',
		profile.bypassIfAboveCustomFormatScore ? 'Yes' : 'No'
	]);
	if (profile.bypassIfAboveCustomFormatScore) {
		rows.push(['Minimum Custom Format Score', String(profile.minimumCustomFormatScore ?? 0)]);
	}

	return join([
		`# ${profile.name}`,
		`A delay profile from the ${data.name} PCD database. ` +
			`Web version: ${SITE_URL}/pcd/${data.id}/delay-profiles/${slug}`,
		'## Configuration',
		settingsTable(rows),
		historySection(history)
	]);
}

export function namingConfigToMarkdown(
	data: CompiledDatabase,
	naming: NamingConfig,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(naming.name);

	const rows: [string, string][] = [
		['Rename', naming.rename ? 'Yes' : 'No'],
		['Character Replacement', naming.replaceIllegalCharacters ? 'Yes' : 'No']
	];
	if (naming.replaceIllegalCharacters) {
		rows.push([
			'Colon Replacement',
			COLON_REPLACEMENT_LABELS[naming.colonReplacementFormat] ?? naming.colonReplacementFormat
		]);
		if (naming.colonReplacementFormat === 'custom' && naming.customColonReplacementFormat) {
			rows.push(['Custom Replacement', `\`${naming.customColonReplacementFormat}\``]);
		}
	}
	const multiEpisodeStyle = naming.arrType === 'sonarr' ? naming.formats.multiEpisodeStyle : null;
	if (multiEpisodeStyle) {
		rows.push([
			'Multi-Episode Style',
			MULTI_EPISODE_LABELS[multiEpisodeStyle] ?? multiEpisodeStyle
		]);
	}

	const formatSections = Object.entries(naming.formats)
		.filter(([key]) => key !== 'multiEpisodeStyle')
		.map(([key, value]) =>
			join([`### ${NAMING_FORMAT_LABELS[key] ?? key}`, fence('text', value)])
		);

	return join([
		`# ${naming.name}`,
		`A ${arrLabel(naming.arrType)} naming configuration from the ${data.name} PCD database. ` +
			`Web version: ${SITE_URL}/pcd/${data.id}/naming/${naming.arrType}/${slug}`,
		'## Configuration',
		settingsTable(rows),
		'## Naming Scheme',
		...formatSections,
		historySection(history)
	]);
}

export function mediaSettingsToMarkdown(
	data: CompiledDatabase,
	settings: MediaSettings,
	arrType: string,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(settings.name);

	const rows: [string, string][] = [
		['Propers & Repacks', formatPropersRepacks(settings.propersRepacks)],
		['Enable Media Info', settings.enableMediaInfo ? 'Yes' : 'No']
	];

	return join([
		`# ${settings.name}`,
		`${arrLabel(arrType)} media management settings from the ${data.name} PCD database. ` +
			`Web version: ${SITE_URL}/pcd/${data.id}/media-settings/${arrType}/${slug}`,
		'## Configuration',
		settingsTable(rows),
		historySection(history)
	]);
}

export function qualityDefinitionsToMarkdown(
	data: CompiledDatabase,
	config: QualityDefinitionConfig,
	arrType: string,
	history: EntityHistoryItem[] = []
): string {
	const slug = slugify(config.name);

	const tierRows = config.tiers.map(
		(t) =>
			`| ${t.qualityName} | ${formatTierSize(t.minSize, 'mb-min')} | ${formatTierSize(t.preferredSize, 'mb-min')} | ${formatTierMaxSize(t.maxSize, 'mb-min', arrType)} |`
	);

	return join([
		`# ${config.name}`,
		`${arrLabel(arrType)} quality definitions from the ${data.name} PCD database. ` +
			`Web version: ${SITE_URL}/pcd/${data.id}/quality-definitions/${arrType}/${slug}`,
		'## Quality Tiers',
		'Sizes are megabytes per minute of runtime.',
		[
			'| Quality | Min | Preferred | Max |',
			'| ------- | --- | --------- | --- |',
			...tierRows
		].join('\n'),
		historySection(history)
	]);
}

// Mirrors the page's History section: one row per op file (a Profilarr
// export batch, one commit), newest first. Field diffs stay on the page.
function historySection(history: EntityHistoryItem[]): string {
	if (history.length === 0) return '';

	const rows = history.map((item) => {
		const commit = item.commitUrl ? `[${item.shortHash}](${item.commitUrl})` : `#${item.op}`;
		const change =
			item.kind === 'updated'
				? item.title
				: `${item.title} (${formatHistoryKind(item.kind)})`;
		return `| ${commit} | ${change.replace(/\|/g, '\\|')} | ${item.date ? isoDate(item.date) : ''} |`;
	});

	return join([
		'## History',
		['| Commit | Change | Date |', '| ------ | ------ | ---- |', ...rows].join('\n')
	]);
}

function settingsTable(rows: [string, string][]): string {
	return [
		'| Setting | Value |',
		'| ------- | ----- |',
		...rows.map(([setting, value]) => `| ${setting} | ${value} |`)
	].join('\n');
}

function detailList(rows: [string, string][]): string {
	return rows.map(([label, value]) => `- **${label}:** ${value}`).join('\n');
}

function arrLabel(arrType: string): string {
	return arrType.charAt(0).toUpperCase() + arrType.slice(1);
}

function referencesSection(databaseId: string, references: RegularExpressionReference[]): string {
	if (references.length === 0) {
		return 'No custom formats reference this regular expression.';
	}

	const items = references.map(
		(reference) =>
			`- [${reference.name}](${SITE_URL}/pcd/${databaseId}/custom-formats/${reference.slug}.md)`
	);

	return join([
		'Custom formats using this regular expression. Each link points to the markdown version.',
		items.join('\n')
	]);
}

function qualityProfileReferencesSection(
	databaseId: string,
	references: QualityProfileReference[]
): string {
	if (references.length === 0) {
		return 'No quality profiles reference this custom format.';
	}

	return references
		.map((reference) => {
			const { radarr, sonarr } = reference.scores;
			let scores: string;

			if (radarr !== null && radarr === sonarr) {
				scores = `Radarr and Sonarr ${formatProfileScore(radarr)}`;
			} else {
				scores = [
					radarr === null ? '' : `Radarr ${formatProfileScore(radarr)}`,
					sonarr === null ? '' : `Sonarr ${formatProfileScore(sonarr)}`
				]
					.filter(Boolean)
					.join('; ');
			}

			return `- [${reference.name}](${SITE_URL}/pcd/${databaseId}/quality-profiles/${reference.slug}): ${scores}`;
		})
		.join('\n');
}
