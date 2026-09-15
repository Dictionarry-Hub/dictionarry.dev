import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { cleanupTempDirs } from './fetch.js';
import type { CompileOptions, CompileResult, NavDatabase, NavEntry } from './compile.js';
import { slugify } from '../../src/lib/shared/utils/slug.js';
import type { PcdConfig, DatabaseEntry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');
const outputDir = join(projectRoot, 'src/lib/data/pcd');

type NavIndex = Record<string, NavDatabase>;

interface SlugCollision {
	database: string;
	entityType: string;
	slug: string;
	names: string[];
}

function checkSlugCollisions(navIndex: NavIndex): SlugCollision[] {
	const collisions: SlugCollision[] = [];

	for (const [dbId, db] of Object.entries(navIndex)) {
		for (const [entityType, entries] of Object.entries(db)) {
			const slugMap = new Map<string, string[]>();
			const names = (entries as (string | NavEntry)[]).map((e) =>
				typeof e === 'string' ? e : `${e.arrType}/${e.name}`
			);

			for (const name of names) {
				const slug = slugify(name);
				const existing = slugMap.get(slug);
				if (existing) {
					existing.push(name);
				} else {
					slugMap.set(slug, [name]);
				}
			}

			for (const [slug, slugNames] of slugMap) {
				if (slugNames.length > 1) {
					// Skip case-only collisions (e.g. SiGMA vs SIGMA) - known upstream issue
					const isCaseOnly = slugNames.every(
						(n) => n.toLowerCase() === slugNames[0].toLowerCase()
					);
					if (!isCaseOnly) {
						collisions.push({ database: dbId, entityType, slug, names: slugNames });
					}
				}
			}
		}
	}

	return collisions;
}

// Each database compiles in its own worker thread (better-sqlite3 is
// synchronous). The worker file resolves relative to this one so it works
// under tsx, which registers its loader for worker threads too.
function compileInWorker(entry: DatabaseEntry, options: CompileOptions): Promise<CompileResult> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./worker.ts', import.meta.url), {
			workerData: { entry, options }
		});
		worker.once('message', (result: CompileResult) => resolve(result));
		worker.once('error', reject);
		worker.once('exit', (code) => {
			if (code !== 0) reject(new Error(`${entry.name}: worker exited with code ${code}`));
		});
	});
}

/** Run tasks with at most `limit` in flight, preserving input order in the result. */
async function inParallel<T, R>(
	items: T[],
	limit: number,
	run: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await run(items[index]);
		}
	});
	await Promise.all(lanes);
	return results;
}

// Usage:
//   pnpm compile:pcd                 compile entities and per-entity history
//   pnpm compile:pcd -- --no-history compile entities only
async function main(): Promise<void> {
	const withHistory = !process.argv.includes('--no-history');
	const config: PcdConfig = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf-8'));

	mkdirSync(outputDir, { recursive: true });

	const parallelism = Math.min(availableParallelism(), config.databases.length);
	console.log(
		`Compiling ${config.databases.length} PCD databases${withHistory ? ' with history' : ''} (${parallelism} at a time)...\n`
	);

	const start = performance.now();
	const results = await inParallel(config.databases, parallelism, async (entry) => {
		const result = await compileInWorker(entry, { outputDir, withHistory });
		const history =
			result.historyEntries === null ? '' : `, ${result.historyEntries} history entries`;
		console.log(
			`  ${entry.name} (${entry.repo}@${entry.branch}) -> ${result.customFormats} CFs, ${result.qualityProfiles} QPs, ${result.regularExpressions} regexes${history} (${result.elapsedMs.toFixed(0)}ms)`
		);
		return result;
	});

	const navIndex: NavIndex = {};
	for (const result of results) navIndex[result.id] = result.nav;

	// Check for slug collisions
	const collisions = checkSlugCollisions(navIndex);
	if (collisions.length > 0) {
		console.error('\nSlug collisions detected (these entities produce identical URL slugs):');
		for (const c of collisions) {
			console.error(`  ${c.database}/${c.entityType}: ${c.names.join(', ')} -> "${c.slug}"`);
		}
		cleanupTempDirs();
		process.exit(1);
	}

	// Write nav index for layout sidebar
	writeFileSync(join(outputDir, 'index.json'), JSON.stringify(navIndex));

	cleanupTempDirs();
	console.log(`\nDone in ${((performance.now() - start) / 1000).toFixed(1)}s.`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
