import { error } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { pcdDatabaseEntries, pcdNavDatabase } from '$lib/shared/utils/pcd/prerender.js';

// Sidebar entity names for one database. Fetched by the root layout at view
// time rather than baked into every prerendered page: the list is 10 KB or
// more per database, and the sidebar is navigation, not page content.
export const prerender = true;

export const entries: EntryGenerator = () => pcdDatabaseEntries();

export const GET: RequestHandler = ({ params }) => {
	const nav = pcdNavDatabase(params.database);
	if (!nav) error(404, 'Database not found');

	return new Response(JSON.stringify(nav), {
		headers: { 'Content-Type': 'application/json' }
	});
};
