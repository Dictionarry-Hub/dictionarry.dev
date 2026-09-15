import { error } from '@sveltejs/kit';
import { marked } from 'marked';
import { sortConditions } from '$lib/shared/utils/pcd/conditions';
import { pickDescriptionFallback } from '$lib/shared/utils/pcd/description';
import { customFormatProfileReferences } from '$lib/shared/utils/pcd/references';
import { pcdNamedEntityEntries } from '$lib/shared/utils/pcd/prerender.js';
import { entityHistory } from '$lib/shared/utils/pcd/history-data';
import { slugify } from '$lib/shared/utils/slug';
import type { CompiledDatabase } from '$lib/types/pcd';
import type { EntryGenerator, PageServerLoad } from './$types';

const NO_DESCRIPTION_MESSAGES = [
	'This custom format speaks for itself.',
	'No description needed. The conditions tell the story.',
	'The configuration is the explanation.',
	'Built from conditions, held together by intent.',
	'Description missing. Conditions ready.',
	'If you know, you know.',
	'A custom format of few words.',
	'Read the conditions. Trust the process.',
	'No description found. The format remains unapologetic.'
] as const;

export const entries: EntryGenerator = () => pcdNamedEntityEntries('customFormats');

export const load: PageServerLoad = async ({ params }) => {
	const { database, slug } = params;

	let data: CompiledDatabase;
	try {
		const module = await import(`$lib/data/pcd/${database}.json`);
		data = module.default as CompiledDatabase;
	} catch {
		error(404, 'Database not found');
	}

	const format = data.customFormats.find((customFormat) => slugify(customFormat.name) === slug);
	if (!format) {
		error(404, 'Custom format not found');
	}

	const descriptionHtml = format.description ? await marked.parse(format.description) : null;
	const noDescriptionMessage = descriptionHtml
		? null
		: pickDescriptionFallback(format.name, NO_DESCRIPTION_MESSAGES);
	const conditions = sortConditions(
		format.conditions.map((condition) => {
			const regularExpressionName =
				condition.data.type === 'release_title' ||
				condition.data.type === 'release_group' ||
				condition.data.type === 'edition'
					? condition.data.regularExpressionName
					: null;
			const regularExpression = regularExpressionName
				? data.regularExpressions.find((entry) => entry.name === regularExpressionName)
				: null;

			return {
				...condition,
				regularExpressionSlug: regularExpression ? slugify(regularExpression.name) : null
			};
		})
	);
	const references = customFormatProfileReferences(data, format.name);

	return {
		format: { ...format, conditions, noDescriptionMessage },
		descriptionHtml,
		references,
		history: entityHistory(data, 'custom_format', format.name)
	};
};
