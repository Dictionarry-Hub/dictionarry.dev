// Loads compiled entity history (src/lib/data/pcd/history/{id}.json, written
// by compile:pcd) and resolves it for display. The folder is optional: when
// the pipeline ran with --no-history every entity simply has no history.

import type { CompiledDatabase, EntityHistory } from '$lib/types/pcd';
import { commitUrl, entityHref, shortHash, type EntityHistoryItem } from './history.js';
import { presentChange, type PresentContext } from './history-view.js';

const files = import.meta.glob<EntityHistory>('/src/lib/data/pcd/history/*.json', {
	eager: true,
	import: 'default'
});

function historyFor(database: string): EntityHistory | null {
	const entry = Object.entries(files).find(([path]) => path.endsWith(`/${database}.json`));
	return entry ? entry[1] : null;
}

/** Current entities of a database keyed like the history (`${entityType}:${name}`). */
function entityIndex(data: CompiledDatabase): Map<string, unknown> {
	const index = new Map<string, unknown>();
	const add = (entityType: string, entities: { name: string }[]) => {
		for (const entity of entities) index.set(`${entityType}:${entity.name}`, entity);
	};
	add('custom_format', data.customFormats);
	add('quality_profile', data.qualityProfiles);
	add('regular_expression', data.regularExpressions);
	add('delay_profile', data.delayProfiles);
	for (const arr of ['radarr', 'sonarr'] as const) {
		add(`${arr}_naming`, data.media[arr].naming);
		add(`${arr}_media_settings`, data.media[arr].settings);
		add(`${arr}_quality_definitions`, data.media[arr].qualityDefinitions);
	}
	return index;
}

/** Date of the last recorded change to an entity (ISO), or null without history. */
export function entityLastChanged(
	database: string,
	entityType: string,
	name: string
): string | null {
	const entries = historyFor(database)?.[`${entityType}:${name}`];
	const last = entries?.at(-1);
	return last && last.date !== '' ? last.date : null;
}

/** History of one entity, newest first. Empty when none was compiled. */
export function entityHistory(
	data: CompiledDatabase,
	entityType: string,
	name: string
): EntityHistoryItem[] {
	const entries = historyFor(data.id)?.[`${entityType}:${name}`] ?? [];
	if (entries.length === 0) return [];

	const index = entityIndex(data);
	const ctx: PresentContext = {
		database: data.id,
		exists: (type, entityName) => index.has(`${type}:${entityName}`),
		current: index.get(`${entityType}:${name}`) ?? null
	};

	return entries
		.map((entry) => ({
			op: entry.op,
			title: entry.title,
			date: entry.date,
			hash: entry.hash,
			shortHash: entry.hash === null ? null : shortHash(entry.hash),
			commitUrl: entry.hash === null ? null : commitUrl(data.repo, entry.hash),
			kind: entry.kind,
			...(entry.renamedFrom === undefined ? {} : { renamedFrom: entry.renamedFrom }),
			changes: entry.changes.flatMap((change) => {
				const view = presentChange(entityType, change, ctx);
				return view === null ? [] : [view];
			}),
			related: entry.related.flatMap((ref) => {
				const href = entityHref(data.id, ref.entityType, ref.name);
				return href === null ? [] : [{ entityType: ref.entityType, label: ref.name, href }];
			})
		}))
		.reverse();
}
