import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/shared/utils/llm/site.js';

// A route rather than a static file so the sitemap line carries the
// configured site origin.
export const prerender = true;

export const GET: RequestHandler = () => {
	const body = ['User-agent: *', 'Disallow:', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join(
		'\n'
	);
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
