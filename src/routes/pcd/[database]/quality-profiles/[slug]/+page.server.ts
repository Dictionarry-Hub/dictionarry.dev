import { error } from '@sveltejs/kit';
import { pcdNamedEntityEntries } from '$lib/shared/utils/pcd/prerender.js';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => pcdNamedEntityEntries('qualityProfiles');

export const load: PageServerLoad = async ({ params }) => {
	const { database, slug } = params;

	let data: CompiledDatabase;
	try {
		const module = await import(`$lib/data/pcd/${database}.json`);
		data = module.default as CompiledDatabase;
	} catch {
		error(404, 'Database not found');
	}

	const profile = data.qualityProfiles.find((item) => slugify(item.name) === slug);
	if (!profile) {
		error(404, 'Quality profile not found');
	}

	return { profile, history: entityHistory(data, 'quality_profile', profile.name) };
};
