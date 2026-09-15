import { error } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { customFormatToMarkdown } from '$lib/shared/utils/llm/index.js';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';

export const prerender = true;

const databases = import.meta.glob<CompiledDatabase>(
	['/src/lib/data/pcd/*.json', '!**/index.json'],
	{ eager: true, import: 'default' }
);

function databaseId(path: string): string {
	return path
		.split('/')
		.at(-1)!
		.replace(/\.json$/, '');
}

export const entries: EntryGenerator = () =>
	Object.entries(databases).flatMap(([path, data]) =>
		data.customFormats
			.map((format) => ({ database: databaseId(path), slug: slugify(format.name) }))
			.filter((entry) => entry.slug !== '')
	);

export const GET: RequestHandler = ({ params }) => {
	const entry = Object.entries(databases).find(([path]) => databaseId(path) === params.database);
	if (!entry) error(404, 'Database not found');

	const data = entry[1];
	const format = data.customFormats.find(
		(customFormat) => slugify(customFormat.name) === params.slug
	);
	if (!format) error(404, 'Custom format not found');

	return new Response(
		customFormatToMarkdown(data, format, entityHistory(data, 'custom_format', format.name)),
		{
			headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
		}
	);
};
