import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const schemaCache = new Map<string, string>();

const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

function git(args: string[], cwd?: string): string {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf-8',
		maxBuffer: 64 * 1024 * 1024,
		env: GIT_ENV,
		stdio: ['ignore', 'pipe', 'inherit']
	});
}

// Blobless clone: full commit history (needed for op file commit lookup) but
// only the checked-out tree's file contents are downloaded.
export function fetchRepo(repo: string, ref: string): string {
	const url = `https://github.com/${repo}.git`;
	const dir = mkdtempSync(join(tmpdir(), 'pcd-'));

	git([
		'-c',
		'advice.detachedHead=false',
		'clone',
		'--quiet',
		'--filter=blob:none',
		'--single-branch',
		'--branch',
		ref,
		url,
		dir
	]);

	return dir;
}

export function fetchSchema(repo: string, version: string): string {
	const cached = schemaCache.get(version);
	if (cached) return cached;

	const path = fetchRepo(repo, version);
	schemaCache.set(version, path);
	return path;
}

export function resolveSchemaVersion(manifest: { dependencies: Record<string, string> }): {
	repo: string;
	version: string;
} {
	// Dependencies use full GitHub URL as key, exact version as value
	// e.g. "https://github.com/Dictionarry-Hub/schema": "1.1.0"
	for (const [url, version] of Object.entries(manifest.dependencies)) {
		const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
		if (match) {
			return { repo: match[1], version };
		}
	}
	throw new Error('No schema dependency found in manifest');
}

export function getOpsDir(repoPath: string): string {
	const opsPath = join(repoPath, 'ops');
	if (!existsSync(opsPath)) {
		throw new Error(`No ops/ directory found in ${repoPath}`);
	}
	return opsPath;
}

export interface OpFileCommit {
	hash: string;
	/** Author date, ISO 8601. */
	date: string;
	message: string;
}

// One git log maps every op file to the commit that added it. Newest commits
// come first, so the first sighting of a path wins if it was ever re-added.
export function opFileCommits(repoPath: string): Map<string, OpFileCommit> {
	const out = git(
		[
			'log',
			'--format=%x01%H%x00%aI%x00%s',
			'--name-only',
			'--no-renames',
			'--diff-filter=A',
			'--',
			'ops'
		],
		repoPath
	);

	return parseOpFileCommits(out);
}

export function parseOpFileCommits(log: string): Map<string, OpFileCommit> {
	const commits = new Map<string, OpFileCommit>();

	for (const block of log.split('\x01')) {
		if (!block.trim()) continue;
		const [header, ...lines] = block.split('\n');
		const [hash, date, message] = header.split('\x00');
		if (!hash || !date) continue;

		for (const line of lines) {
			const path = line.trim();
			if (!path.startsWith('ops/') || !path.endsWith('.sql')) continue;
			const file = path.slice('ops/'.length);
			if (!commits.has(file)) {
				commits.set(file, { hash, date, message: message ?? '' });
			}
		}
	}

	return commits;
}

export function cleanupTempDirs(): void {
	// The OS will clean up temp dirs, but we clear the cache to free references
	schemaCache.clear();
}
