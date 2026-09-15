import { describe, expect, it } from 'vitest';
import { renderSitemap } from '$lib/shared/utils/seo/sitemap';

describe('renderSitemap', () => {
	it('lists each entry as an absolute URL with an optional date-only lastmod', () => {
		const xml = renderSitemap('https://profilarr.com/', [
			{ path: '/' },
			{ path: '/wiki/eei', lastmod: '2025-08-07' },
			{ path: '/pcd/dictionarry/custom-formats/dsnp', lastmod: '2026-09-08T20:25:43+00:00' }
		]);

		expect(xml).toContain('<loc>https://profilarr.com/</loc>');
		expect(xml).toContain(
			'<loc>https://profilarr.com/wiki/eei</loc><lastmod>2025-08-07</lastmod>'
		);
		expect(xml).toContain(
			'<loc>https://profilarr.com/pcd/dictionarry/custom-formats/dsnp</loc><lastmod>2026-09-08</lastmod>'
		);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
	});

	it('escapes XML special characters in URLs', () => {
		const xml = renderSitemap('https://profilarr.com', [{ path: '/a&b' }]);

		expect(xml).toContain('<loc>https://profilarr.com/a&amp;b</loc>');
	});
});
