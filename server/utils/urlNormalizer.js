import validator from 'validator';

// Known marketing and tracking parameters to strip
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'ref_src',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'zanpid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'yclid',
  'twclid',
  'origin',
  'source',
]);

// Multi-tenant platforms where the path or specific subdomains represent distinct products
const MULTI_TENANT_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'huggingface.co',
  'producthunt.com',
  'notion.site',
  'substack.com',
  'medium.com',
  'chrome.google.com',
  'chromewebstore.google.com',
  'marketplace.visualstudio.com',
  'npm.js',
  'npmjs.com',
  'pypi.org',
]);

/**
 * Normalizes a URL for deduplication and consistent storage.
 * @param {string} rawUrl - The input URL
 * @returns {object} { canonicalUrl, normalizedUrl, domain, rootDomain, isMultiTenant, isValid }
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'Empty or invalid URL string' };
  }

  let cleaned = rawUrl.trim();

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch (err) {
    return { isValid: false, error: `Invalid URL format: ${err.message}` };
  }

  // Ensure protocol is https if http is provided (most modern sites enforce https)
  // Store protocol as https unless explicitly non-standard
  let protocol = parsed.protocol.toLowerCase();
  if (protocol === 'http:') {
    protocol = 'https:';
  }

  // Normalize hostname: lowercase, remove trailing dot, strip standard www.
  let hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const domainWithWww = hostname;
  const bareHostname = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

  // Extract root domain (e.g., 'cursor.com' from 'www.cursor.com' or 'docs.cursor.com')
  const hostParts = bareHostname.split('.');
  const rootDomain = hostParts.length >= 2 ? hostParts.slice(-2).join('.') : bareHostname;

  const isMultiTenant = MULTI_TENANT_DOMAINS.has(bareHostname) || MULTI_TENANT_DOMAINS.has(rootDomain);

  // Remove tracking search params
  const cleanParams = new URLSearchParams();
  parsed.searchParams.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lowerKey)) {
      cleanParams.set(key, val);
    }
  });

  // Normalize pathname: remove duplicate slashes, remove trailing slash if length > 1
  let pathname = parsed.pathname.replace(/\/+/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // If not multi-tenant and pathname is just a generic homepage index or empty, treat as root
  if (!isMultiTenant && (pathname === '/index.html' || pathname === '/index.php' || pathname === '')) {
    pathname = '/';
  }

  const search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
  const port = (parsed.port && parsed.port !== '80' && parsed.port !== '443') ? `:${parsed.port}` : '';

  // Canonical URL (https://bareHostname/path?params)
  const canonicalUrl = `${protocol}//${bareHostname}${port}${pathname === '/' ? '' : pathname}${search}`;
  
  // Normalized URL for strict deduplication lookup (without query params for standard sites)
  const dedupePath = isMultiTenant ? pathname : (pathname === '/' ? '' : pathname);
  const normalizedUrl = `${protocol}//${bareHostname}${port}${dedupePath}`.toLowerCase();

  return {
    isValid: true,
    canonicalUrl,
    normalizedUrl,
    domain: bareHostname,
    rootDomain,
    isMultiTenant,
    protocol,
    pathname,
  };
}

/**
 * Validates whether a domain is structurally safe and not an internal network or SSRF target.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isPublicHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase().trim();

  // Block localhost and standard private/loopback strings
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return false;
  }

  // Block IP formats (IPv4 & IPv6 private ranges)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = h.match(ipv4Regex);
  if (match) {
    const [, o1, o2, o3, o4] = match.map(Number);
    if (o1 === 0 || o1 === 10 || o1 === 127) return false; // 0.0.0.0, 10.x, 127.x
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return false; // 172.16-31.x
    if (o1 === 192 && o2 === 168) return false; // 192.168.x
    if (o1 === 169 && o2 === 254) return false; // Link-local / cloud metadata
    if (o1 >= 224) return false; // Multicast / reserved
  }

  if (h.includes(':') || h.startsWith('[') || h === '::1') {
    return false; // IPv6 loopback / private
  }

  // Must contain at least one dot and valid characters
  return h.includes('.') && /^[a-z0-9.-]+$/.test(h);
}

