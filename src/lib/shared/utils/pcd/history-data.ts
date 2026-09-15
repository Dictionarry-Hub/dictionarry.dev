// Loads compiled entity history (src/lib/data/pcd/history/{id}.json, written
// by compile:pcd) and resolves it for display. The folder is optional: when
// the pipeline ran with --no-history every entity simply has no history.

import type { CompiledDatabase, EntityHistory } from '$lib/types/pcd';
import {
	commitUrl,
	entityHref,
	formatEntityType,
	shortHash,
	type EntityHistoryItem
} from './history.js';

const files = import.meta.glob<EntityHistory>('/src/lib/data/pcd/history/*.json', {
	eager: true,
	import: 'default'
});

function historyFor(database: string): EntityHistory | null {
	const entry = Object.entries(files).find(([path]) => path.endsWith(`/${database}.json`));
	return entry ? entry[1] : null;
}

/** History of one entity, newest first. Empty when none was compiled. */
export function entityHistory(
	data: Pick<CompiledDatabase, 'id' | 'repo'>,
	entityType: string,
	name: string
): EntityHistoryItem[] {
	const entries = historyFor(data.id)?.[`${entityType}:${name}`] ?? [];

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
			changes: entry.changes,
			related: entry.related.flatMap((ref) => {
				const href = entityHref(data.id, ref.entityType, ref.name);
				return href === null
					? []
					: [{ label: `${ref.name} (${formatEntityType(ref.entityType)})`, href }];
			})
		}))
		.reverse();
}
