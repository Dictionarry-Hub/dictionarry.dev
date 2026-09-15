import { error } from '@sveltejs/kit';
import { pcdArrEntityEntries } from '$lib/shared/utils/pcd/prerender.js';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => pcdArrEntityEntries('qualityDefinitions');

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

	const config = arrMedia.qualityDefinitions.find((q) => slugify(q.name) === slug);
	if (!config) {
		error(404, 'Quality definitions not found');
	}

	return {
		config,
		database,
		arrType,
		history: entityHistory(data, `${arrType}_quality_definitions`, config.name)
	};
};
