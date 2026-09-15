// Display helpers for entity history, shared by the entity pages and the
// llm serializers so the History section and its markdown artifact cannot
// drift apart. Loading the compiled history lives in history-data.ts.

import type { HistoryEntry } from '$lib/types/pcd';
import { slugify } from '$lib/shared/utils/slug';
import type { ChangeView } from './history-view.js';

export interface EntityHistoryLink {
	entityType: string;
	label: string;
	href: string;
}

/** A history entry resolved for display: changes presented, links built, hash shortened. */
export interface EntityHistoryItem {
	op: number;
	title: string;
	date: string;
	hash: string | null;
	shortHash: string | null;
	commitUrl: string | null;
	kind: HistoryEntry['kind'];
	renamedFrom?: string;
	changes: ChangeView[];
	related: EntityHistoryLink[];
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
	custom_format: 'Custom Format',
	quality_profile: 'Quality Profile',
	regular_expression: 'Regular Expression',
	delay_profile: 'Delay Profile',
	radarr_naming: 'Radarr Naming',
	sonarr_naming: 'Sonarr Naming',
	radarr_media_settings: 'Radarr Media Settings',
	sonarr_media_settings: 'Sonarr Media Settings',
	radarr_quality_definitions: 'Radarr Quality Definitions',
	sonarr_quality_definitions: 'Sonarr Quality Definitions'
};

export function formatEntityType(entityType: string): string {
	return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

/** Site path of an entity page, or null for types without pages. */
export function entityHref(database: string, entityType: string, name: string): string | null {
	const slug = slugify(name);
	if (slug === '') return null;
	const arr = entityType.match(/^(radarr|sonarr)_(.+)$/);
	if (arr) {
		const segment = {
			naming: 'naming',
			media_settings: 'media-settings',
			quality_definitions: 'quality-definitions'
		}[arr[2]];
		return segment ? `/pcd/${database}/${segment}/${arr[1]}/${slug}` : null;
	}
	const segment = {
		custom_format: 'custom-formats',
		quality_profile: 'quality-profiles',
		regular_expression: 'regular-expressions',
		delay_profile: 'delay-profiles'
	}[entityType];
	return segment ? `/pcd/${database}/${segment}/${slug}` : null;
}

export function commitUrl(repo: string, hash: string): string {
	return `https://github.com/${repo}/commit/${hash}`;
}

export function shortHash(hash: string): string {
	return hash.slice(0, 7);
}

const KIND_LABELS: Record<HistoryEntry['kind'], string> = {
	created: 'Created',
	updated: 'Updated',
	deleted: 'Deleted',
	renamed: 'Renamed'
};

export function formatHistoryKind(kind: HistoryEntry['kind']): string {
	return KIND_LABELS[kind];
}

const FIELD_LABELS: Record<string, string> = {
	conditions: 'Condition',
	tests: 'Test',
	tags: 'Tags',
	scoring: 'Score',
	qualities: 'Quality',
	languages: 'Language',
	tiers: 'Tier',
	formats: 'Format',
	data: 'Value',
	group: 'Group',
	members: 'Members',
	description: 'Description',
	pattern: 'Pattern',
	regex101Id: 'regex101',
	includeInRename: 'Include in Rename',
	regularExpressionName: 'Regular Expression',
	arrType: 'Applies To',
	negate: 'Negated',
	required: 'Required',
	upgradesAllowed: 'Upgrades Allowed',
	minimumCustomFormatScore: 'Minimum Custom Format Score',
	upgradeUntilScore: 'Upgrade Until Score',
	upgradeScoreIncrement: 'Upgrade Score Increment',
	preferredProtocol: 'Download Protocol',
	usenetDelay: 'Usenet Delay',
	torrentDelay: 'Torrent Delay',
	bypassIfHighestQuality: 'Bypass if Highest Quality',
	bypassIfAboveCustomFormatScore: 'Bypass if Above Custom Format Score',
	rename: 'Rename',
	replaceIllegalCharacters: 'Character Replacement',
	colonReplacementFormat: 'Colon Replacement',
	customColonReplacementFormat: 'Custom Replacement',
	propersRepacks: 'Propers & Repacks',
	enableMediaInfo: 'Enable Media Info',
	minSize: 'Min',
	maxSize: 'Max',
	preferredSize: 'Preferred',
	minBytes: 'Min Size',
	maxBytes: 'Max Size',
	minYear: 'Min Year',
	maxYear: 'Max Year',
	enabled: 'Enabled',
	upgradeUntil: 'Upgrade Until',
	position: 'Position',
	score: 'Score',
	type: 'Type'
};

/** Human label for a change path like `conditions[Friday].data.regularExpressionName`. */
export function formatChangePath(path: string): string {
	const parts: string[] = [];
	for (const match of path.matchAll(/([^.[\]]+)(?:\[([^\]]*)\])?/g)) {
		const [, key, item] = match;
		parts.push(FIELD_LABELS[key] ?? humanize(key));
		if (item !== undefined) parts.push(item.replace(/\|(radarr|sonarr)$/, ' ($1)'));
	}
	return parts.join(' › ');
}

function humanize(key: string): string {
	const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
