import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/shared/utils/llm/site.js';
import { renderSitemap, sitemapEntries, type ArticleLike } from '$lib/shared/utils/seo/sitemap.js';

export const prerender = true;

const devLogModules = import.meta.glob<{ metadata: { created: string } }>(
	'/src/routes/dev-logs/**/+page.svx',
	{ eager: true }
);

const wikiModules = import.meta.glob<{ metadata: { created: string } }>(
	'/src/routes/wiki/**/+page.svx',
	{ eager: true }
);

function articles(modules: Record<string, { metadata: { created: string } }>): ArticleLike[] {
	return Object.entries(modules).map(([path, module]) => ({
		slug: path.split('/').at(-2)!,
		created: String(module.metadata.created)
	}));
}

export const GET: RequestHandler = () => {
	const xml = renderSitemap(
		SITE_URL,
		sitemapEntries(articles(devLogModules), articles(wikiModules))
	);
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
