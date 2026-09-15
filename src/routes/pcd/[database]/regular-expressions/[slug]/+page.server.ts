import { error } from '@sveltejs/kit';
import { marked } from 'marked';
import { pickDescriptionFallback } from '$lib/shared/utils/pcd/description';
import { pcdNamedEntityEntries } from '$lib/shared/utils/pcd/prerender.js';
import { regularExpressionReferences } from '$lib/shared/utils/pcd/references';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';
import type { EntryGenerator, PageServerLoad } from './$types';

const NO_DESCRIPTION_MESSAGES = [
	'This regex speaks for itself.',
	'No description needed. Just vibes.',
	'The pattern is the documentation.',
	'Self-documenting regex. A rare breed.',
	'If you know, you know.',
	'Description not found. Regex not sorry.',
	'Some things are better left unexplained.',
	'It matches what it matches.',
	'This regex matches the correct thing 100% of the time 40% of the time.'
] as const;

export const entries: EntryGenerator = () => pcdNamedEntityEntries('regularExpressions');

export const load: PageServerLoad = async ({ params }) => {
	const { database, slug } = params;

	let data: CompiledDatabase;
	try {
		const module = await import(`$lib/data/pcd/${database}.json`);
		data = module.default as CompiledDatabase;
	} catch {
		error(404, 'Database not found');
	}

	const regex = data.regularExpressions.find((re) => slugify(re.name) === slug);
	if (!regex) {
		error(404, 'Regular expression not found');
	}

	const descriptionHtml = regex.description ? await marked.parse(regex.description) : null;
	const noDescriptionMessage = descriptionHtml
		? null
		: pickDescriptionFallback(regex.name, NO_DESCRIPTION_MESSAGES);

	const references = regularExpressionReferences(data, regex.name);

	return {
		regex: { ...regex, noDescriptionMessage },
		descriptionHtml,
		references,
		database,
		history: entityHistory(data, 'regular_expression', regex.name)
	};
};
