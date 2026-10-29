import * as cheerio from 'cheerio';
import { normalizeUrl, isPublicHost } from '../utils/urlNormalizer.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Searches the live web using DuckDuckGo HTML endpoint to discover real websites and URLs.
 * @param {string} query 
 * @param {number} maxResults 
 * @returns {Promise<Array<{ title: string, url: string, snippet: string, domain: string }>>}
 */
export async function searchLiveWeb(query, maxResults = 10) {
  const results = [];
  try {
    const encodedQuery = encodeURIComponent(`${query} software tool website official`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml',
      },
      body: `q=${encodedQuery}`,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      $('.result').each((i, el) => {
        if (results.length >= maxResults) return false;

        const titleEl = $(el).find('.result__title a');
        const snippetEl = $(el).find('.result__snippet');
        const rawHref = titleEl.attr('href');

        if (!rawHref) return;

        // DuckDuckGo redirects through /l/?uddg=URL
        let targetUrl = rawHref;
        if (rawHref.includes('/l/?uddg=')) {
          try {
            const urlObj = new URL(`https://duckduckgo.com${rawHref}`);
            const uddg = urlObj.searchParams.get('uddg');
            if (uddg) targetUrl = decodeURIComponent(uddg);
          } catch {
            // fallback to rawHref
          }
        }

        const norm = normalizeUrl(targetUrl);
        if (norm.isValid && isPublicHost(norm.domain)) {
          // Avoid search engines or ad aggregators
          if (!['duckduckgo.com', 'google.com', 'bing.com', 'yahoo.com', 'yandex.com'].includes(norm.domain)) {
            results.push({
              title: titleEl.text().trim(),
              url: norm.canonicalUrl,
              snippet: snippetEl.text().trim(),
              domain: norm.domain,
            });
          }
        }
      });
    }
  } catch (err) {
    console.warn(`[WebSearch] Search query "${query}" notice:`, err.message);
  }

  return results;
}

/**
 * Searches GitHub API for open-source repositories when category is developer or computer science related.
 * @param {string} query 
 * @param {number} maxResults 
 * @returns {Promise<Array<{ title: string, url: string, snippet: string, stars: number }>>}
 */
export async function searchGitHubRepos(query, maxResults = 5) {
  const results = [];
  try {
    const encodedQuery = encodeURIComponent(`${query} in:name,description`);
    const apiUrl = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=${maxResults}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Ultimate-AI-Directory-App',
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          results.push({
            title: item.name,
            url: item.html_url,
            snippet: (item.description || '').slice(0, 200),
            stars: item.stargazers_count,
            domain: 'github.com',
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[WebSearch] GitHub repo search notice:`, err.message);
  }

  return results;
}

