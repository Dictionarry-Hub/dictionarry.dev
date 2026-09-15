// One database, end to end: clone, resolve schema, compile, extract, replay
// history, write outputs. Self-contained so it can run in a worker thread;
// the entry point (index.ts) fans databases out and merges the nav data.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileDatabase, createDatabase } from './build.js';
import { extractDatabase } from './extract.js';
import { fetchRepo, fetchSchema, getOpsDir, opFileCommits, resolveSchemaVersion } from './fetch.js';
import type { EntityHistory } from './history.js';
import { replayWithHistory } from './replay.js';
import type { DatabaseEntry, PcdManifest } from './types.js';
import type { CompiledDatabase } from '../../src/lib/types/pcd.js';

export interface NavEntry {
	name: string;
	arrType: string;
}

export interface NavDatabase {
	customFormats: string[];
	qualityProfiles: string[];
	regularExpressions: string[];
	delayProfiles: string[];
	naming: NavEntry[];
	mediaSettings: NavEntry[];
	qualityDefinitions: NavEntry[];
}

export interface CompileOptions {
	outputDir: string;
	withHistory: boolean;
}

export interface CompileResult {
	id: string;
	nav: NavDatabase;
	customFormats: number;
	qualityProfiles: number;
	regularExpressions: number;
	historyEntries: number | null;
	elapsedMs: number;
}

export function compileEntry(entry: DatabaseEntry, options: CompileOptions): CompileResult {
	const start = performance.now();

	const repoPath = fetchRepo(entry.repo, entry.branch);
	const manifest: PcdManifest = JSON.parse(readFileSync(join(repoPath, 'pcd.json'), 'utf-8'));

	const { repo: schemaRepo, version: schemaVersion } = resolveSchemaVersion(manifest);
	const schemaPath = fetchSchema(schemaRepo, schemaVersion);

	// Schema ops then base ops. With history on, base ops replay one file at a
	// time and the entity state comes out of the same pass.
	const schemaOpsDir = getOpsDir(schemaPath);
	const baseOpsDir = getOpsDir(repoPath);
	let compiled: CompiledDatabase;
	let history: EntityHistory | null = null;

	if (options.withHistory) {
		const db = createDatabase(schemaOpsDir);
		const commits = opFileCommits(repoPath);
		const result = replayWithHistory(db, baseOpsDir, commits, entry, manifest, schemaVersion);
		db.close();
		compiled = result.compiled;
		history = result.history;
	} else {
		const db = compileDatabase(schemaOpsDir, baseOpsDir);
		compiled = extractDatabase(db, entry, manifest, schemaVersion);
		db.close();
	}

	mkdirSync(options.outputDir, { recursive: true });
	writeFileSync(join(options.outputDir, `${entry.id}.json`), JSON.stringify(compiled, null, 2));
	if (history !== null) {
		// Own folder so the routes' `pcd/*.json` database globs never see it.
		const historyDir = join(options.outputDir, 'history');
		mkdirSync(historyDir, { recursive: true });
		writeFileSync(join(historyDir, `${entry.id}.json`), JSON.stringify(history));
	}

	return {
		id: entry.id,
		nav: navOf(compiled),
		customFormats: compiled.customFormats.length,
		qualityProfiles: compiled.qualityProfiles.length,
		regularExpressions: compiled.regularExpressions.length,
		historyEntries:
			history === null
				? null
				: Object.values(history).reduce((n, entries) => n + entries.length, 0),
		elapsedMs: performance.now() - start
	};
}

function navOf(compiled: CompiledDatabase): NavDatabase {
	const media = (arrType: 'radarr' | 'sonarr') => ({
		naming: compiled.media[arrType].naming.map((n) => ({ name: n.name, arrType })),
		settings: compiled.media[arrType].settings.map((s) => ({ name: s.name, arrType })),
		qualityDefs: compiled.media[arrType].qualityDefinitions.map((q) => ({
			name: q.name,
			arrType
		}))
	});
	const radarr = media('radarr');
	const sonarr = media('sonarr');

	return {
		customFormats: compiled.customFormats.map((cf) => cf.name),
		qualityProfiles: compiled.qualityProfiles.map((qp) => qp.name),
		regularExpressions: compiled.regularExpressions.map((re) => re.name),
		delayProfiles: compiled.delayProfiles.map((dp) => dp.name),
		naming: [...radarr.naming, ...sonarr.naming],
		mediaSettings: [...radarr.settings, ...sonarr.settings],
		qualityDefinitions: [...radarr.qualityDefs, ...sonarr.qualityDefs]
	};
}
