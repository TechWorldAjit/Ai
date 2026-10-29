import * as cheerio from 'cheerio';
import { normalizeUrl, isPublicHost } from '../utils/urlNormalizer.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Safely verifies an external website, resolves redirects, and extracts page metadata.
 * Implements strict SSRF protection and graceful handling of bot challenges.
 * @param {string} rawUrl 
 * @param {number} timeoutMs 
 * @returns {Promise<object>} Verification result
 */
export async function verifyWebsite(rawUrl, timeoutMs = 6000) {
  const norm = normalizeUrl(rawUrl);
  if (!norm.isValid) {
    return {
      isOnline: false,
      statusCode: null,
      finalUrl: rawUrl,
      title: '',
      metaDescription: '',
      verifiedAt: new Date(),
      status: 'broken',
      failureReason: norm.error,
    };
  }

  if (!isPublicHost(norm.domain)) {
    return {
      isOnline: false,
      statusCode: null,
      finalUrl: norm.canonicalUrl,
      title: '',
      metaDescription: '',
      verifiedAt: new Date(),
      status: 'unverified',
      failureReason: 'Blocked private / local network hostname (SSRF Protection)',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(norm.canonicalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const statusCode = response.status;
    const finalUrl = response.url || norm.canonicalUrl;

    // Check if response redirected to a private host
    try {
      const finalHost = new URL(finalUrl).hostname;
      if (!isPublicHost(finalHost)) {
        return {
          isOnline: false,
          statusCode,
          finalUrl,
          title: '',
          metaDescription: '',
          verifiedAt: new Date(),
          status: 'unverified',
          failureReason: 'Redirected to private / loopback IP address',
        };
      }
    } catch {
      // ignore URL parsing error on finalUrl
    }

    // If server responds with 200-399
    if (statusCode >= 200 && statusCode < 400) {
      let title = '';
      let metaDescription = '';
      let canonicalTag = null;

      try {
        const text = await response.text();
        const $ = cheerio.load(text.slice(0, 100000)); // Limit parsing to first 100KB for speed

        title = $('title').first().text().trim() ||
                $('meta[property="og:title"]').attr('content')?.trim() ||
                $('meta[name="twitter:title"]').attr('content')?.trim() || '';

        metaDescription = $('meta[name="description"]').attr('content')?.trim() ||
                          $('meta[property="og:description"]').attr('content')?.trim() ||
                          $('meta[name="twitter:description"]').attr('content')?.trim() || '';

        canonicalTag = $('link[rel="canonical"]').attr('href')?.trim() || null;
      } catch {
        // If HTML parsing fails, status code is still 200 OK
      }

      return {
        isOnline: true,
        statusCode,
        finalUrl,
        title: title.slice(0, 300),
        metaDescription: metaDescription.slice(0, 500),
        canonicalTag,
        verifiedAt: new Date(),
        status: 'active',
        failureReason: null,
      };
    }

    // Cloudflare / Bot protection status codes (403, 429, 503)
    if ([403, 429, 503].includes(statusCode)) {
      return {
        isOnline: true,
        statusCode,
        finalUrl,
        title: '',
        metaDescription: '',
        verifiedAt: new Date(),
        status: 'active', // Bot-protected sites like Notion, OpenAI are active
        failureReason: `Site returned HTTP ${statusCode} (Automated crawler challenge or rate limit)`,
      };
    }

    // 404 Not Found or 410 Gone
    if (statusCode === 404 || statusCode === 410) {
      return {
        isOnline: false,
        statusCode,
        finalUrl,
        title: '',
        metaDescription: '',
        verifiedAt: new Date(),
        status: 'broken',
        failureReason: `HTTP ${statusCode} Resource Not Found`,
      };
    }

    return {
      isOnline: false,
      statusCode,
      finalUrl,
      title: '',
      metaDescription: '',
      verifiedAt: new Date(),
      status: 'unverified',
      failureReason: `HTTP status ${statusCode}`,
    };

  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      isOnline: false,
      statusCode: null,
      finalUrl: norm.canonicalUrl,
      title: '',
      metaDescription: '',
      verifiedAt: new Date(),
      status: 'unverified',
      failureReason: isTimeout ? 'Connection timed out after 6 seconds' : err.message,
    };
  }
}

