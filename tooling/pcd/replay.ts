// SQLite adapter for the history replay: reads op files, wires the pure
// buildHistory fold to a live database, and returns both the compiled state
// and the per-entity history from one pass.

import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	extractCustomFormats,
	extractDatabase,
	extractDelayProfiles,
	extractMediaSettings,
	extractNaming,
	extractQualityDefinitions,
	extractQualityProfiles,
	extractRegularExpressions
} from './extract.js';
import type { OpFileCommit } from './fetch.js';
import { buildHistory, entityKey, type EntityHistory } from './history.js';
import { parseOpFile } from './ops.js';
import type { CompiledDatabase } from '../../src/lib/types/pcd.js';
import type { DatabaseEntry, PcdManifest } from './types.js';

export interface ReplayResult {
	compiled: CompiledDatabase;
	history: EntityHistory;
}

export function replayWithHistory(
	db: Database.Database,
	baseOpsDir: string,
	commits: Map<string, OpFileCommit>,
	entry: DatabaseEntry,
	manifest: PcdManifest,
	schemaVersion: string
): ReplayResult {
	const files = readdirSync(baseOpsDir)
		.filter((f) => f.endsWith('.sql'))
		.map((f) => parseOpFile(readFileSync(join(baseOpsDir, f), 'utf-8'), f));

	// Assigned inside the extractAll callback; the cast keeps the union type
	// so the null check after the replay is not narrowed away.
	let compiled = null as CompiledDatabase | null;

	const history = buildHistory({
		files,
		commits,
		exec: (sql) => db.exec(sql),
		extractOne: (entityType, name) => extractOne(db, entityType, name),
		extractAll: () => {
			compiled = extractDatabase(db, entry, manifest, schemaVersion);
			return entityMap(compiled);
		}
	});

	if (compiled === null) throw new Error('History replay produced no compiled database');
	return { compiled, history };
}

function extractOne(db: Database.Database, entityType: string, name: string): unknown {
	switch (entityType) {
		case 'custom_format':
			return extractCustomFormats(db, name)[0] ?? null;
		case 'quality_profile':
			return extractQualityProfiles(db, name)[0] ?? null;
		case 'regular_expression':
			return extractRegularExpressions(db, name)[0] ?? null;
		case 'delay_profile':
			return extractDelayProfiles(db, name)[0] ?? null;
		case 'radarr_naming':
		case 'sonarr_naming':
			return extractNaming(db, arrOf(entityType), name)[0] ?? null;
		case 'radarr_media_settings':
		case 'sonarr_media_settings':
			return extractMediaSettings(db, arrOf(entityType), name)[0] ?? null;
		case 'radarr_quality_definitions':
		case 'sonarr_quality_definitions':
			return extractQualityDefinitions(db, arrOf(entityType), name)[0] ?? null;
		default:
			throw new Error(`Unknown op entity type: ${entityType}`);
	}
}

function arrOf(entityType: string): 'radarr' | 'sonarr' {
	return entityType.startsWith('radarr_') ? 'radarr' : 'sonarr';
}

/** Every entity in a compiled database, keyed like the history. */
export function entityMap(compiled: CompiledDatabase): Map<string, unknown> {
	const map = new Map<string, unknown>();
	const add = (entityType: string, entities: { name: string }[]) => {
		for (const entity of entities) map.set(entityKey(entityType, entity.name), entity);
	};
	add('custom_format', compiled.customFormats);
	add('quality_profile', compiled.qualityProfiles);
	add('regular_expression', compiled.regularExpressions);
	add('delay_profile', compiled.delayProfiles);
	for (const arr of ['radarr', 'sonarr'] as const) {
		add(`${arr}_naming`, compiled.media[arr].naming);
		add(`${arr}_media_settings`, compiled.media[arr].settings);
		add(`${arr}_quality_definitions`, compiled.media[arr].qualityDefinitions);
	}
	return map;
}
