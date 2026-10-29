import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeUrl, isPublicHost } from '../utils/urlNormalizer.js';

describe('URL Normalizer & SSRF Protection', () => {
  it('should strip tracking parameters and fragments', () => {
    const raw = 'https://www.example.com/products/tool?utm_source=twitter&utm_medium=cpc&ref=xyz#intro';
    const norm = normalizeUrl(raw);

    assert.strictEqual(norm.isValid, true);
    assert.strictEqual(norm.canonicalUrl, 'https://example.com/products/tool');
    assert.strictEqual(norm.domain, 'example.com');
  });

  it('should normalize protocol to https and remove trailing slashes', () => {
    const raw = 'http://linear.app/';
    const norm = normalizeUrl(raw);

    assert.strictEqual(norm.isValid, true);
    assert.strictEqual(norm.canonicalUrl, 'https://linear.app');
    assert.strictEqual(norm.domain, 'linear.app');
  });

  it('should preserve subpaths for multi-tenant hosts like GitHub', () => {
    const repo1 = 'https://github.com/facebook/react';
    const repo2 = 'https://github.com/vuejs/core';

    const norm1 = normalizeUrl(repo1);
    const norm2 = normalizeUrl(repo2);

    assert.strictEqual(norm1.isMultiTenant, true);
    assert.notStrictEqual(norm1.normalizedUrl, norm2.normalizedUrl);
    assert.strictEqual(norm1.normalizedUrl, 'https://github.com/facebook/react');
  });

  it('should block private, loopback, and cloud metadata hostnames (SSRF)', () => {
    assert.strictEqual(isPublicHost('localhost'), false);
    assert.strictEqual(isPublicHost('127.0.0.1'), false);
    assert.strictEqual(isPublicHost('10.0.0.1'), false);
    assert.strictEqual(isPublicHost('192.168.1.1'), false);
    assert.strictEqual(isPublicHost('169.254.169.254'), false);
    assert.strictEqual(isPublicHost('::1'), false);

    // Public hostnames should pass
    assert.strictEqual(isPublicHost('cursor.com'), true);
    assert.strictEqual(isPublicHost('github.com'), true);
  });
});

