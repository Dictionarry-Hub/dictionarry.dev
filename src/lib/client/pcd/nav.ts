import type { PcdNavDatabase } from '$lib/types/pcd';

// Sidebar entity names, one static JSON per database (see the nav.json
// route). Cached per database for the life of the page so switching back and
// forth costs one request each.
const cache = new Map<string, Promise<PcdNavDatabase>>();

export function loadPcdNav(database: string): Promise<PcdNavDatabase> {
	let pending = cache.get(database);
	if (!pending) {
		pending = fetch(`/pcd/${database}/nav.json`).then((response) => {
			if (!response.ok) throw new Error(`${response.status} fetching nav for ${database}`);
			return response.json() as Promise<PcdNavDatabase>;
		});
		pending.catch(() => cache.delete(database));
		cache.set(database, pending);
	}
	return pending;
}
