import { error } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import { mediaSettingsToMarkdown } from '$lib/shared/utils/llm/index.js';
import type { CompiledDatabase } from '$lib/types/pcd';

export const prerender = true;

// Compiled PCD output, one file per database. index.json is nav-only data,
// not a database.
const databases = import.meta.glob<CompiledDatabase>(
	['/src/lib/data/pcd/*.json', '!**/index.json'],
	{ eager: true, import: 'default' }
);

// The database id is the output filename, same derivation as the PCD
// pipeline (config `id` becomes `{id}.json`).
function databaseId(path: string): string {
	return path
		.split('/')
		.at(-1)!
		.replace(/\.json$/, '');
}

// Names made of only special characters slugify to the empty string. Those
// entities have no HTML page either (no nav link can reach them), so they
// get no artifact rather than failing the build.
export const entries: EntryGenerator = () =>
	Object.entries(databases).flatMap(([path, data]) =>
		Object.entries(data.media).flatMap(([arrType, arrMedia]) =>
			arrMedia.settings
				.map((settings) => ({
					database: databaseId(path),
					arrType,
					slug: slugify(settings.name)
				}))
				.filter((entry) => entry.slug !== '')
		)
	);

export const GET: RequestHandler = ({ params }) => {
	const entry = Object.entries(databases).find(([path]) => databaseId(path) === params.database);
	if (!entry) error(404, 'Database not found');

	const data = entry[1];
	const arrMedia = data.media[params.arrType as keyof typeof data.media];
	if (!arrMedia) error(404, 'Arr type not found');

	const settings = arrMedia.settings.find((s) => slugify(s.name) === params.slug);
	if (!settings) error(404, 'Media settings not found');

	return new Response(
		mediaSettingsToMarkdown(
			data,
			settings,
			params.arrType,
			entityHistory(data, `${params.arrType}_media_settings`, settings.name)
		),
		{
			headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
		}
	);
};
