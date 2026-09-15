import type { PcdNavIndex } from '$lib/types/pcd';

export const prerender = true;

interface ArticleMeta {
	title: string;
	slug: string;
	created: string;
}

function articleNav(files: Record<string, { metadata: ArticleMeta }>, base: string) {
	return Object.entries(files)
		.map(([path, module]) => {
			const slug = path.split('/').at(-2)!;
			return {
				title: module.metadata.title,
				href: `${base}/${slug}`,
				created: module.metadata.created
			};
		})
		.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

export async function load() {
	const devLogFiles = import.meta.glob<{ metadata: ArticleMeta }>(
		'/src/routes/dev-logs/**/+page.svx',
		{ eager: true }
	);
	const wikiFiles = import.meta.glob<{ metadata: ArticleMeta }>('/src/routes/wiki/**/+page.svx', {
		eager: true
	});

	const devLogs = articleNav(devLogFiles, '/dev-logs');
	const wiki = articleNav(wikiFiles, '/wiki');

	// Which databases have compiled data. The entity names themselves are
	// fetched per database at view time (see /pcd/[database]/nav.json), so
	// 4,500 prerendered pages do not each carry the full index.
	const pcdNavFiles = import.meta.glob<{ default: PcdNavIndex }>('/src/lib/data/pcd/index.json', {
		eager: true
	});
	const pcdDatabases = Object.keys(Object.values(pcdNavFiles)[0]?.default ?? {});

	return { devLogs, wiki, pcdDatabases };
}
