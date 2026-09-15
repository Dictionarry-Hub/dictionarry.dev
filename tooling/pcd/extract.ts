import type Database from 'better-sqlite3';
import type {
	CompiledDatabase,
	CustomFormat,
	Condition,
	ConditionData,
	CustomFormatTest,
	QualityProfile,
	ProfileLanguage,
	QualityEntry,
	QualityGroup,
	ProfileScore,
	RegularExpression,
	DelayProfile,
	NamingConfig,
	MediaSettings,
	QualityDefinitionConfig,
	QualityDefinitionTier
} from '../../src/lib/types/pcd.js';
import type { DatabaseEntry, PcdManifest } from './types.js';

// Sonarr stores these as integers in the DB; resolve to semantic strings matching Radarr's format
const SONARR_COLON_REPLACEMENT: Record<number, string> = {
	0: 'delete',
	1: 'dash',
	2: 'spaceDash',
	3: 'spaceDashSpace',
	4: 'smart',
	5: 'custom'
};

const SONARR_MULTI_EPISODE_STYLE: Record<number, string> = {
	0: 'extend',
	1: 'duplicate',
	2: 'repeat',
	3: 'scene',
	4: 'range',
	5: 'prefixedRange'
};

export function extractDatabase(
	db: Database.Database,
	entry: DatabaseEntry,
	manifest: PcdManifest,
	schemaVersion: string
): CompiledDatabase {
	return {
		id: entry.id,
		name: entry.name,
		repo: entry.repo,
		branch: entry.branch,
		version: manifest.version,
		schemaVersion,
		description: manifest.description,
		arrTypes: manifest.arr_types ?? ['radarr', 'sonarr'],
		customFormats: extractCustomFormats(db),
		qualityProfiles: extractQualityProfiles(db),
		regularExpressions: extractRegularExpressions(db),
		delayProfiles: extractDelayProfiles(db),
		media: {
			radarr: {
				naming: extractNaming(db, 'radarr'),
				settings: extractMediaSettings(db, 'radarr'),
				qualityDefinitions: extractQualityDefinitions(db, 'radarr')
			},
			sonarr: {
				naming: extractNaming(db, 'sonarr'),
				settings: extractMediaSettings(db, 'sonarr'),
				qualityDefinitions: extractQualityDefinitions(db, 'sonarr')
			}
		}
	};
}

// --- Custom Formats ---

export function extractCustomFormats(db: Database.Database, name?: string): CustomFormat[] {
	const rows = db
		.prepare(
			`SELECT name, description, include_in_rename FROM custom_formats ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		description: string | null;
		include_in_rename: number;
	}[];

	return rows.map((row) => ({
		name: row.name,
		description: row.description,
		includeInRename: row.include_in_rename === 1,
		tags: extractTags(db, 'custom_format_tags', 'custom_format_name', row.name),
		conditions: extractConditions(db, row.name),
		tests: extractTests(db, row.name)
	}));
}

function extractConditions(db: Database.Database, cfName: string): Condition[] {
	const rows = db
		.prepare(
			`SELECT name, type, arr_type, negate, required
			 FROM custom_format_conditions
			 WHERE custom_format_name = ?
			 ORDER BY name`
		)
		.all(cfName) as {
		name: string;
		type: string;
		arr_type: string;
		negate: number;
		required: number;
	}[];

	return rows.map((row) => ({
		name: row.name,
		type: row.type as Condition['type'],
		arrType: row.arr_type,
		negate: row.negate === 1,
		required: row.required === 1,
		data: extractConditionData(db, cfName, row.name, row.type)
	}));
}

function extractConditionData(
	db: Database.Database,
	cfName: string,
	condName: string,
	type: string
): ConditionData {
	switch (type) {
		case 'release_title':
		case 'release_group':
		case 'edition': {
			const row = db
				.prepare(
					`SELECT regular_expression_name
					 FROM condition_patterns
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { regular_expression_name: string } | undefined;
			return {
				type: type as 'release_title' | 'release_group' | 'edition',
				regularExpressionName: row?.regular_expression_name ?? ''
			};
		}
		case 'language': {
			const row = db
				.prepare(
					`SELECT language_name, except_language
					 FROM condition_languages
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as
				{ language_name: string; except_language: number } | undefined;
			return {
				type: 'language',
				languageName: row?.language_name ?? '',
				exceptLanguage: (row?.except_language ?? 0) === 1
			};
		}
		case 'source': {
			const row = db
				.prepare(
					`SELECT source FROM condition_sources
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { source: string } | undefined;
			return { type: 'source', source: row?.source ?? '' };
		}
		case 'resolution': {
			const row = db
				.prepare(
					`SELECT resolution FROM condition_resolutions
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { resolution: string } | undefined;
			return { type: 'resolution', resolution: row?.resolution ?? '' };
		}
		case 'quality_modifier': {
			const row = db
				.prepare(
					`SELECT quality_modifier FROM condition_quality_modifiers
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { quality_modifier: string } | undefined;
			return { type: 'quality_modifier', qualityModifier: row?.quality_modifier ?? '' };
		}
		case 'release_type': {
			const row = db
				.prepare(
					`SELECT release_type FROM condition_release_types
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { release_type: string } | undefined;
			return { type: 'release_type', releaseType: row?.release_type ?? '' };
		}
		case 'indexer_flag': {
			const row = db
				.prepare(
					`SELECT flag FROM condition_indexer_flags
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as { flag: string } | undefined;
			return { type: 'indexer_flag', flag: row?.flag ?? '' };
		}
		case 'size': {
			const row = db
				.prepare(
					`SELECT min_bytes, max_bytes FROM condition_sizes
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as
				{ min_bytes: number | null; max_bytes: number | null } | undefined;
			return {
				type: 'size',
				minBytes: row?.min_bytes ?? null,
				maxBytes: row?.max_bytes ?? null
			};
		}
		case 'year': {
			const row = db
				.prepare(
					`SELECT min_year, max_year FROM condition_years
					 WHERE custom_format_name = ? AND condition_name = ?`
				)
				.get(cfName, condName) as
				{ min_year: number | null; max_year: number | null } | undefined;
			return { type: 'year', minYear: row?.min_year ?? null, maxYear: row?.max_year ?? null };
		}
		default:
			throw new Error(`Unknown condition type: ${type}`);
	}
}

function extractTests(db: Database.Database, cfName: string): CustomFormatTest[] {
	const rows = db
		.prepare(
			`SELECT title, type, should_match, description
			 FROM custom_format_tests
			 WHERE custom_format_name = ?
			 ORDER BY title`
		)
		.all(cfName) as {
		title: string;
		type: string;
		should_match: number;
		description: string | null;
	}[];

	return rows.map((row) => ({
		title: row.title,
		type: row.type,
		shouldMatch: row.should_match === 1,
		description: row.description
	}));
}

// --- Quality Profiles ---

export function extractQualityProfiles(db: Database.Database, name?: string): QualityProfile[] {
	const rows = db
		.prepare(
			`SELECT name, description, upgrades_allowed, minimum_custom_format_score,
			        upgrade_until_score, upgrade_score_increment
			 FROM quality_profiles ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		description: string | null;
		upgrades_allowed: number;
		minimum_custom_format_score: number;
		upgrade_until_score: number;
		upgrade_score_increment: number;
	}[];

	return rows.map((row) => ({
		name: row.name,
		description: row.description,
		tags: extractTags(db, 'quality_profile_tags', 'quality_profile_name', row.name),
		upgradesAllowed: row.upgrades_allowed === 1,
		minimumCustomFormatScore: row.minimum_custom_format_score,
		upgradeUntilScore: row.upgrade_until_score,
		upgradeScoreIncrement: row.upgrade_score_increment,
		languages: extractProfileLanguages(db, row.name),
		qualities: extractProfileQualities(db, row.name),
		scoring: extractProfileScoring(db, row.name)
	}));
}

function extractProfileLanguages(db: Database.Database, profileName: string): ProfileLanguage[] {
	const rows = db
		.prepare(
			`SELECT language_name, type
			 FROM quality_profile_languages
			 WHERE quality_profile_name = ?
			 ORDER BY language_name`
		)
		.all(profileName) as { language_name: string; type: string }[];

	return rows.map((row) => ({ name: row.language_name, type: row.type }));
}

function extractProfileQualities(db: Database.Database, profileName: string): QualityEntry[] {
	const rows = db
		.prepare(
			`SELECT quality_name, quality_group_name, position, enabled, upgrade_until
			 FROM quality_profile_qualities
			 WHERE quality_profile_name = ?
			 ORDER BY position`
		)
		.all(profileName) as {
		quality_name: string | null;
		quality_group_name: string | null;
		position: number;
		enabled: number;
		upgrade_until: number;
	}[];

	return rows.map((row) => ({
		position: row.position,
		enabled: row.enabled === 1,
		upgradeUntil: row.upgrade_until === 1,
		quality: row.quality_name,
		group: row.quality_group_name
			? extractQualityGroup(db, profileName, row.quality_group_name)
			: null
	}));
}

function extractQualityGroup(
	db: Database.Database,
	profileName: string,
	groupName: string
): QualityGroup {
	const members = db
		.prepare(
			`SELECT quality_name
			 FROM quality_group_members
			 WHERE quality_profile_name = ? AND quality_group_name = ?
			 ORDER BY position`
		)
		.all(profileName, groupName) as { quality_name: string }[];

	return {
		name: groupName,
		members: members.map((m) => m.quality_name)
	};
}

function extractProfileScoring(db: Database.Database, profileName: string): ProfileScore[] {
	const rows = db
		.prepare(
			`SELECT custom_format_name, arr_type, score
			 FROM quality_profile_custom_formats
			 WHERE quality_profile_name = ?
			 ORDER BY custom_format_name, arr_type`
		)
		.all(profileName) as { custom_format_name: string; arr_type: string; score: number }[];

	return rows.map((row) => ({
		customFormatName: row.custom_format_name,
		arrType: row.arr_type,
		score: row.score
	}));
}

// --- Regular Expressions ---

export function extractRegularExpressions(
	db: Database.Database,
	name?: string
): RegularExpression[] {
	const rows = db
		.prepare(
			`SELECT name, pattern, description, regex101_id FROM regular_expressions ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		pattern: string;
		description: string | null;
		regex101_id: string | null;
	}[];

	return rows.map((row) => ({
		name: row.name,
		pattern: row.pattern,
		description: row.description,
		regex101Id: row.regex101_id,
		tags: extractTags(db, 'regular_expression_tags', 'regular_expression_name', row.name)
	}));
}

// --- Delay Profiles ---

export function extractDelayProfiles(db: Database.Database, name?: string): DelayProfile[] {
	const rows = db
		.prepare(
			`SELECT name, preferred_protocol, usenet_delay, torrent_delay,
			        bypass_if_highest_quality, bypass_if_above_custom_format_score,
			        minimum_custom_format_score
			 FROM delay_profiles ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		preferred_protocol: string;
		usenet_delay: number | null;
		torrent_delay: number | null;
		bypass_if_highest_quality: number;
		bypass_if_above_custom_format_score: number;
		minimum_custom_format_score: number | null;
	}[];

	return rows.map((row) => ({
		name: row.name,
		preferredProtocol: row.preferred_protocol,
		usenetDelay: row.usenet_delay,
		torrentDelay: row.torrent_delay,
		bypassIfHighestQuality: row.bypass_if_highest_quality === 1,
		bypassIfAboveCustomFormatScore: row.bypass_if_above_custom_format_score === 1,
		minimumCustomFormatScore: row.minimum_custom_format_score
	}));
}

// --- Media Management ---

export function extractNaming(
	db: Database.Database,
	arrType: 'radarr' | 'sonarr',
	name?: string
): NamingConfig[] {
	const table = `${arrType}_naming`;

	if (arrType === 'radarr') {
		const rows = db
			.prepare(
				`SELECT name, rename, movie_format, movie_folder_format,
				        replace_illegal_characters, colon_replacement_format
				 FROM ${table} ${nameFilter(name)} ORDER BY name`
			)
			.all(...nameArgs(name)) as {
			name: string;
			rename: number;
			movie_format: string;
			movie_folder_format: string;
			replace_illegal_characters: number;
			colon_replacement_format: string;
		}[];

		return rows.map((row) => ({
			name: row.name,
			arrType: 'radarr',
			rename: row.rename === 1,
			replaceIllegalCharacters: row.replace_illegal_characters === 1,
			colonReplacementFormat: row.colon_replacement_format,
			formats: {
				movieFormat: row.movie_format,
				movieFolderFormat: row.movie_folder_format
			}
		}));
	}

	const rows = db
		.prepare(
			`SELECT name, rename, standard_episode_format, daily_episode_format,
			        anime_episode_format, series_folder_format, season_folder_format,
			        replace_illegal_characters, colon_replacement_format,
			        custom_colon_replacement_format, multi_episode_style
			 FROM ${table} ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		rename: number;
		standard_episode_format: string;
		daily_episode_format: string;
		anime_episode_format: string;
		series_folder_format: string;
		season_folder_format: string;
		replace_illegal_characters: number;
		colon_replacement_format: number;
		custom_colon_replacement_format: string | null;
		multi_episode_style: number;
	}[];

	return rows.map((row) => ({
		name: row.name,
		arrType: 'sonarr',
		rename: row.rename === 1,
		replaceIllegalCharacters: row.replace_illegal_characters === 1,
		colonReplacementFormat: SONARR_COLON_REPLACEMENT[row.colon_replacement_format] ?? 'delete',
		customColonReplacementFormat: row.custom_colon_replacement_format,
		formats: {
			standardEpisodeFormat: row.standard_episode_format,
			dailyEpisodeFormat: row.daily_episode_format,
			animeEpisodeFormat: row.anime_episode_format,
			seriesFolderFormat: row.series_folder_format,
			seasonFolderFormat: row.season_folder_format,
			multiEpisodeStyle: SONARR_MULTI_EPISODE_STYLE[row.multi_episode_style] ?? 'extend'
		}
	}));
}

export function extractMediaSettings(
	db: Database.Database,
	arrType: 'radarr' | 'sonarr',
	name?: string
): MediaSettings[] {
	const table = `${arrType}_media_settings`;

	const rows = db
		.prepare(
			`SELECT name, propers_repacks, enable_media_info FROM ${table} ${nameFilter(name)} ORDER BY name`
		)
		.all(...nameArgs(name)) as {
		name: string;
		propers_repacks: string;
		enable_media_info: number;
	}[];

	return rows.map((row) => ({
		name: row.name,
		propersRepacks: row.propers_repacks,
		enableMediaInfo: row.enable_media_info === 1
	}));
}

export function extractQualityDefinitions(
	db: Database.Database,
	arrType: 'radarr' | 'sonarr',
	name?: string
): QualityDefinitionConfig[] {
	const table = `${arrType}_quality_definitions`;

	const names = db
		.prepare(`SELECT DISTINCT name FROM ${table} ${nameFilter(name)} ORDER BY name`)
		.all(...nameArgs(name)) as {
		name: string;
	}[];

	return names.map((n) => {
		const tiers = db
			.prepare(
				`SELECT quality_name, min_size, max_size, preferred_size
				 FROM ${table}
				 WHERE name = ?
				 ORDER BY quality_name`
			)
			.all(n.name) as {
			quality_name: string;
			min_size: number;
			max_size: number;
			preferred_size: number;
		}[];

		return {
			name: n.name,
			tiers: tiers.map((t): QualityDefinitionTier => ({
				qualityName: t.quality_name,
				minSize: t.min_size,
				maxSize: t.max_size,
				preferredSize: t.preferred_size
			}))
		};
	});
}

// --- Shared ---

// Optional single-entity filter so history replay can re-read one entity
// instead of the whole table.
function nameFilter(name: string | undefined): string {
	return name === undefined ? '' : 'WHERE name = ?';
}

function nameArgs(name: string | undefined): string[] {
	return name === undefined ? [] : [name];
}

function extractTags(
	db: Database.Database,
	table: string,
	column: string,
	entityName: string
): string[] {
	const rows = db
		.prepare(`SELECT tag_name FROM ${table} WHERE ${column} = ? ORDER BY tag_name`)
		.all(entityName) as { tag_name: string }[];

	return rows.map((r) => r.tag_name);
}
