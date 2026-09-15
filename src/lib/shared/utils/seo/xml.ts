// Sitemap XML rendering. Kept free of data imports so it can be unit tested
// without compiled PCD output (the Test job does not run compile:pcd).

export interface SitemapEntry {
	/** Site-relative path starting with `/`. */
	path: string;
	/** ISO date or timestamp. */
	lastmod?: string;
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
