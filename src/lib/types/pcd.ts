// Compiled PCD data shape - used by both the build pipeline and page.server.ts

export interface CompiledDatabase {
	id: string;
	name: string;
	/** GitHub owner/repo the ops were compiled from. */
	repo: string;
	/** Git ref the ops were compiled from. */
	branch: string;
	version: string;
	schemaVersion: string;
	description: string;
	arrTypes: string[];
	customFormats: CustomFormat[];
	qualityProfiles: QualityProfile[];
	regularExpressions: RegularExpression[];
	delayProfiles: DelayProfile[];
	media: {
		radarr: ArrMedia;
		sonarr: ArrMedia;
	};
}

export interface ArrMedia {
	naming: NamingConfig[];
	settings: MediaSettings[];
	qualityDefinitions: QualityDefinitionConfig[];
}

// --- Custom Formats ---

export interface CustomFormat {
	name: string;
	description: string | null;
	includeInRename: boolean;
	tags: string[];
	conditions: Condition[];
	tests: CustomFormatTest[];
}

export interface Condition {
	name: string;
	type: ConditionType;
	arrType: string;
	negate: boolean;
	required: boolean;
	data: ConditionData;
}

export type ConditionType =
	| 'release_title'
	| 'release_group'
	| 'edition'
	| 'language'
	| 'source'
	| 'resolution'
	| 'quality_modifier'
	| 'release_type'
	| 'indexer_flag'
	| 'size'
	| 'year';

export type ConditionData =
	| PatternCondition
	| LanguageCondition
	| SourceCondition
	| ResolutionCondition
	| QualityModifierCondition
	| ReleaseTypeCondition
	| IndexerFlagCondition
	| SizeCondition
	| YearCondition;

export interface PatternCondition {
	type: 'release_title' | 'release_group' | 'edition';
	regularExpressionName: string;
}

export interface LanguageCondition {
	type: 'language';
	languageName: string;
	exceptLanguage: boolean;
}

export interface SourceCondition {
	type: 'source';
	source: string;
}

export interface ResolutionCondition {
	type: 'resolution';
	resolution: string;
}

export interface QualityModifierCondition {
	type: 'quality_modifier';
	qualityModifier: string;
}

export interface ReleaseTypeCondition {
	type: 'release_type';
	releaseType: string;
}

export interface IndexerFlagCondition {
	type: 'indexer_flag';
	flag: string;
}

export interface SizeCondition {
	type: 'size';
	minBytes: number | null;
	maxBytes: number | null;
}

export interface YearCondition {
	type: 'year';
	minYear: number | null;
	maxYear: number | null;
}

export interface CustomFormatTest {
	title: string;
	type: string;
	shouldMatch: boolean;
	description: string | null;
}

// --- Quality Profiles ---

export interface QualityProfile {
	name: string;
	description: string | null;
	tags: string[];
	upgradesAllowed: boolean;
	minimumCustomFormatScore: number;
	upgradeUntilScore: number;
	upgradeScoreIncrement: number;
	languages: ProfileLanguage[];
	qualities: QualityEntry[];
	scoring: ProfileScore[];
}

export interface ProfileLanguage {
	name: string;
	type: string;
}

export interface QualityEntry {
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	quality: string | null;
	group: QualityGroup | null;
}

export interface QualityGroup {
	name: string;
	members: string[];
}

export interface ProfileScore {
	customFormatName: string;
	arrType: string;
	score: number;
}

// --- Regular Expressions ---

export interface RegularExpression {
	name: string;
	pattern: string;
	description: string | null;
	regex101Id: string | null;
	tags: string[];
}

// --- Delay Profiles ---

export interface DelayProfile {
	name: string;
	preferredProtocol: string;
	usenetDelay: number | null;
	torrentDelay: number | null;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCustomFormatScore: boolean;
	minimumCustomFormatScore: number | null;
}

// --- Media Management ---

export interface NamingConfig {
	name: string;
	arrType: 'radarr' | 'sonarr';
	rename: boolean;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: string;
	customColonReplacementFormat: string | null;
	formats: Record<string, string>;
}

export interface MediaSettings {
	name: string;
	propersRepacks: string;
	enableMediaInfo: boolean;
}

export interface QualityDefinitionConfig {
	name: string;
	tiers: QualityDefinitionTier[];
}

export interface QualityDefinitionTier {
	qualityName: string;
	minSize: number;
	maxSize: number;
	preferredSize: number;
}

// --- Navigation ---
// Entity names per database, written to src/lib/data/pcd/index.json by the
// pipeline. Drives prerender entries and the sidebar (fetched per database
// at view time from /pcd/{database}/nav.json).

export interface PcdNavEntry {
	name: string;
	arrType: string;
}

export interface PcdNavDatabase {
	customFormats: string[];
	qualityProfiles: string[];
	regularExpressions: string[];
	delayProfiles: string[];
	naming: PcdNavEntry[];
	mediaSettings: PcdNavEntry[];
	qualityDefinitions: PcdNavEntry[];
}

export type PcdNavIndex = Record<string, PcdNavDatabase>;

// --- History ---
// Produced by the pipeline's history replay (tooling/pcd/history.ts) and
// written to src/lib/data/pcd/{id}.history.json.

export interface EntityChange {
	/** Dotted path with keyed array items, e.g. conditions[Extras].data.regularExpressionName */
	path: string;
	kind: 'added' | 'removed' | 'changed';
	from?: unknown;
	to?: unknown;
}

export interface EntityRef {
	entityType: string;
	name: string;
}

export interface HistoryEntry {
	/** Op file number. */
	op: number;
	title: string;
	/** Commit date, or the export timestamp when no commit is known. ISO 8601. */
	date: string;
	/** Full commit sha, or null when the file has no known commit. */
	hash: string | null;
	kind: 'created' | 'updated' | 'deleted' | 'renamed';
	renamedFrom?: string;
	changes: EntityChange[];
	/** Other entities touched in the same op file. */
	related: EntityRef[];
}

/** Keyed by `${entityType}:${name}`. Entries are in replay order (oldest first). */
export type EntityHistory = Record<string, HistoryEntry[]>;
