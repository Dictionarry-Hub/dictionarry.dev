import pcdNavData from '../../../data/pcd/index.json';
import { slugify } from '../slug.js';
import type { PcdNavDatabase, PcdNavIndex } from '$lib/types/pcd';

type NamedEntityKey = 'customFormats' | 'qualityProfiles' | 'regularExpressions' | 'delayProfiles';
type ArrEntityKey = 'naming' | 'mediaSettings' | 'qualityDefinitions';

const pcdNav = pcdNavData as PcdNavIndex;

/** Entity names of one database, for the sidebar endpoint. */
export function pcdNavDatabase(database: string): PcdNavDatabase | undefined {
	return pcdNav[database];
}

export function pcdDatabaseEntries(): { database: string }[] {
	return Object.keys(pcdNav).map((database) => ({ database }));
}

export function pcdNamedEntityEntries(key: NamedEntityKey): { database: string; slug: string }[] {
	return Object.entries(pcdNav).flatMap(([database, data]) =>
		data[key]
			.map((name) => ({ database, slug: slugify(name) }))
			.filter((entry) => entry.slug !== '')
	);
}

export function pcdArrEntityEntries(
	key: ArrEntityKey
): { database: string; arrType: string; slug: string }[] {
	return Object.entries(pcdNav).flatMap(([database, data]) =>
		data[key]
			.map((entry) => ({ database, arrType: entry.arrType, slug: slugify(entry.name) }))
			.filter((entry) => entry.slug !== '')
	);
}

export function expectedPcdHtmlRoutes(): string[] {
	const indexRoutes = pcdDatabaseEntries().flatMap(({ database }) => [
		`/pcd/${database}/quality-profiles`,
		`/pcd/${database}/custom-formats`,
		`/pcd/${database}/regular-expressions`,
		`/pcd/${database}/delay-profiles`,
		`/pcd/${database}/naming`,
		`/pcd/${database}/media-settings`,
		`/pcd/${database}/quality-definitions`
	]);

	const namedRoutes = (
		[
			['customFormats', 'custom-formats'],
			['qualityProfiles', 'quality-profiles'],
			['regularExpressions', 'regular-expressions'],
			['delayProfiles', 'delay-profiles']
		] as const
	).flatMap(([key, segment]) =>
		pcdNamedEntityEntries(key).map(
			({ database, slug }) => `/pcd/${database}/${segment}/${slug}`
		)
	);

	const arrRoutes = (
		[
			['naming', 'naming'],
			['mediaSettings', 'media-settings'],
			['qualityDefinitions', 'quality-definitions']
		] as const
	).flatMap(([key, segment]) =>
		pcdArrEntityEntries(key).map(
			({ database, arrType, slug }) => `/pcd/${database}/${segment}/${arrType}/${slug}`
		)
	);

	return [...indexRoutes, ...namedRoutes, ...arrRoutes];
}
