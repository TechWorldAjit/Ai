const API_BASE = '/api';

// Fast in-memory cache for API calls to optimize performance and prevent flickers
const clientCache = new Map();
const CACHE_TTL_MS = 15000;

export function clearClientCache() {
  clientCache.clear();
}

export async function fetchCategories() {
  const cacheKey = 'categories:all';
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to load categories');
  const data = await res.json();
  clientCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchCategory(slug) {
  const cacheKey = `category:${slug}`;
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(`${API_BASE}/categories/${slug}`);
  if (!res.ok) throw new Error('Failed to load category details');
  const data = await res.json();
  clientCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function evaluateCategory(name) {
  const res = await fetch(`${API_BASE}/categories/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Category evaluation failed');
  return await res.json();
}

export async function createCategory(data) {
  clearClientCache();
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create category');
  }
  return await res.json();
}

export async function deleteCategory(slug) {
  clearClientCache();
  const res = await fetch(`${API_BASE}/categories/${slug}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete category');
  }
  return data;
}

export async function fetchResources(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, v);
    }
  });

  const cacheKey = `resources:${query.toString()}`;
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(`${API_BASE}/resources?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load resources');
  const data = await res.json();
  clientCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchResource(id) {
  const res = await fetch(`${API_BASE}/resources/${id}`);
  if (!res.ok) throw new Error('Failed to load tool details');
  return await res.json();
}

export async function bookmarkResource(id) {
  clearClientCache();
  const res = await fetch(`${API_BASE}/resources/${id}/bookmark`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to save bookmark');
  return await res.json();
}

export async function verifyResource(id) {
  clearClientCache();
  const res = await fetch(`${API_BASE}/resources/${id}/verify`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to verify tool');
  return await res.json();
}

export async function triggerCategoryUpdate(categorySlug, targetCount = 100) {
  clearClientCache();
  const res = await fetch(`${API_BASE}/jobs/category-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categorySlug, targetCount }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to start update job');
  }
  return data;
}

export async function triggerGlobalDiscovery() {
  clearClientCache();
  const res = await fetch(`${API_BASE}/jobs/global-discovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to start global discovery');
  }
  return data;
}

export async function fetchJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job status');
  return await res.json();
}

export async function fetchAdminStats() {
  const res = await fetch(`${API_BASE}/admin/stats`);
  if (!res.ok) throw new Error('Failed to fetch admin stats');
  return await res.json();
}

export function subscribeToJobStream(jobId, onUpdate, onComplete, onError) {
  const eventSource = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') return;

      onUpdate(data);

      if (data.stage === 'Completed' || data.stage === 'Failed') {
        eventSource.close();
        if (onComplete) onComplete(data);
      }
    } catch (err) {
      console.error('[SSE] Parse error:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('[SSE] Stream closed or encountered error, fallback to polling if needed.');
    eventSource.close();
    if (onError) onError(err);
  };

  return () => eventSource.close();
}

