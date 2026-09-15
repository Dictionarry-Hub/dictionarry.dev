// Sitemap generation. One entry per prerendered HTML page, with lastmod
// where a real date exists: article publish dates and, for PCD entities,
// the date of the last commit that touched them (from the history replay).
// Artifacts (.md, .yaml, .json) are alternate representations, not pages,
// and are left out.

import { pcdDatabaseEntries, pcdNavDatabase } from '../pcd/prerender.js';
import { entityLastChanged } from '../pcd/history-data.js';
import { slugify } from '../slug.js';

export interface SitemapEntry {
	/** Site-relative path starting with `/`. */
	path: string;
	/** ISO date or timestamp. */
	lastmod?: string;
}

export interface ArticleLike {
	slug: string;
	created: string;
}

// /pcd is a client-side redirect stub, not a page.
export const STATIC_PAGES = ['/', '/dev-logs', '/wiki', '/api/v1'] as const;

const NAMED_TYPES = [
	['customFormats', 'custom-formats', 'custom_format'],
	['qualityProfiles', 'quality-profiles', 'quality_profile'],
	['regularExpressions', 'regular-expressions', 'regular_expression'],
	['delayProfiles', 'delay-profiles', 'delay_profile']
] as const;

const ARR_TYPES = [
	['naming', 'naming', 'naming'],
	['mediaSettings', 'media-settings', 'media_settings'],
	['qualityDefinitions', 'quality-definitions', 'quality_definitions']
] as const;

export function sitemapEntries(devLogs: ArticleLike[], wiki: ArticleLike[]): SitemapEntry[] {
	const entries: SitemapEntry[] = STATIC_PAGES.map((path) => ({ path }));

	for (const article of devLogs) {
		entries.push({ path: `/dev-logs/${article.slug}`, lastmod: article.created });
	}
	for (const article of wiki) {
		entries.push({ path: `/wiki/${article.slug}`, lastmod: article.created });
	}

	for (const { database } of pcdDatabaseEntries()) {
		const nav = pcdNavDatabase(database);
		if (!nav) continue;

		for (const [key, segment, entityType] of NAMED_TYPES) {
			entries.push({ path: `/pcd/${database}/${segment}` });
			for (const name of nav[key]) {
				const slug = slugify(name);
				if (slug === '') continue;
				entries.push(
					withLastmod(
						`/pcd/${database}/${segment}/${slug}`,
						entityLastChanged(database, entityType, name)
					)
				);
			}
		}

		for (const [key, segment, suffix] of ARR_TYPES) {
			entries.push({ path: `/pcd/${database}/${segment}` });
			for (const { name, arrType } of nav[key]) {
				const slug = slugify(name);
				if (slug === '') continue;
				entries.push(
					withLastmod(
						`/pcd/${database}/${segment}/${arrType}/${slug}`,
						entityLastChanged(database, `${arrType}_${suffix}`, name)
					)
				);
			}
		}
	}

	return entries;
}

function withLastmod(path: string, lastmod: string | null): SitemapEntry {
	return lastmod === null ? { path } : { path, lastmod };
}

export function renderSitemap(siteUrl: string, entries: SitemapEntry[]): string {
	const origin = siteUrl.replace(/\/$/, '');
	const urls = entries.map((entry) => {
		const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : '';
		return `  <url><loc>${escapeXml(origin + entry.path)}</loc>${lastmod}</url>`;
	});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		'</urlset>',
		''
	].join('\n');
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
