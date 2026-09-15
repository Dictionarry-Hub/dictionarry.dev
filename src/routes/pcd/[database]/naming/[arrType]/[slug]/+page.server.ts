import { error } from '@sveltejs/kit';
import { pcdArrEntityEntries } from '$lib/shared/utils/pcd/prerender.js';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => pcdArrEntityEntries('naming');

export const load: PageServerLoad = async ({ params }) => {
	const { database, slug, arrType } = params;

	let data: CompiledDatabase;
	try {
		const module = await import(`$lib/data/pcd/${database}.json`);
		data = module.default as CompiledDatabase;
	} catch {
		error(404, 'Database not found');
	}

	const arrMedia = data.media[arrType as keyof typeof data.media];
	if (!arrMedia) {
		error(404, 'Arr type not found');
	}

	const naming = arrMedia.naming.find((n) => slugify(n.name) === slug);
	if (!naming) {
		error(404, 'Naming config not found');
	}

	return { naming, database, history: entityHistory(data, `${arrType}_naming`, naming.name) };
};
