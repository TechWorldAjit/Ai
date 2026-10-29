import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Clean and parse JSON from a model response that might be enclosed in markdown code fences.
 */
function cleanAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response from model');
  }

  let text = rawText.trim();
  // Strip ```json or ``` markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Find first { or [ and last } or ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = 0;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  let endIdx = text.length;
  if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
    endIdx = lastBrace + 1;
  } else if (lastBracket !== -1) {
    endIdx = lastBracket + 1;
  }

  const candidate = text.slice(startIdx, endIdx);
  return JSON.parse(candidate);
}

/**
 * Generic Gemini API request helper with retry and timeout.
 */
async function callGemini(prompt, systemInstruction = '', retries = 2) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for thinking models

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429 && attempt < retries) {
          console.warn(`[Gemini] Rate limited (429). Retrying in ${attempt * 3}s...`);
          await new Promise((r) => setTimeout(r, attempt * 3000));
          continue;
        }
        throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error('Gemini response contained no content parts');
      }

      return cleanAndParseJSON(candidateText);
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) {
        throw err;
      }
      console.warn(`[Gemini] Call attempt ${attempt} failed: ${err.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Discovers candidate websites, tools, and services for a given category.
 * Integrates live search evidence to avoid pure hallucinations.
 */
export async function discoverCandidatesForCategory({
  categoryName,
  categoryDescription,
  webEvidence = [],
  existingDomains = [],
  targetCount = 12,
}) {
  const evidenceSnippet = webEvidence
    .slice(0, 8)
    .map((e, idx) => `[Evidence ${idx + 1}] Title: ${e.title} | URL: ${e.url} | Snippet: ${e.snippet}`)
    .join('\n');

  const existingDomainsSnippet = existingDomains.slice(0, 50).join(', ');

  const systemInstruction = `You are an elite web researcher and software intelligence system.
Your mission is to identify the best, most useful, legitimate, official websites and tools for a specific software/web directory category.
STRICT RULES:
1. Every officialUrl must be the real, official homepage or repository of the product. Do NOT invent URLs or domain names.
2. Descriptions must follow a strict principle: "Fewer words, more meaning." Exactly ONE concise sentence (max 20 words). No marketing fluff, no buzzwords ("revolutionary", "game-changing"). Example: "Collaborative interface design and prototyping."
3. Return valid JSON adhering to the specified schema.
4. Do NOT include tools whose domains are in the Excluded Domains list: ${existingDomainsSnippet}.`;

  const prompt = `Research and identify up to ${targetCount} verified, distinct, high-utility websites or software tools for the category: "${categoryName}".
Category Context: ${categoryDescription || categoryName}

Live Web Research Evidence Collected:
${evidenceSnippet || 'No external snippets available; use verified knowledge base.'}

Output JSON schema:
{
  "category": "${categoryName}",
  "candidates": [
    {
      "name": "Canonical Product Name",
      "officialUrl": "https://example.com",
      "description": "One concise sentence explaining the primary utility.",
      "tags": ["tag1", "tag2", "tag3"],
      "pricing": "free | freemium | paid | open-source | unknown",
      "qualityScore": 85, // estimated long-term utility score (1-100)
      "trendScore": 80,   // estimated current momentum / popularity score (1-100)
      "trendReason": "Brief explanation of relevance or trend standing",
      "confidence": 0.95
    }
  ]
}`;

  const result = await callGemini(prompt, systemInstruction);
  return result.candidates || [];
}

/**
 * Analyzes a proposed new category from user input to determine intent, synonyms,
 * hierarchy placement, and whether an existing category should be reused instead.
 */
export async function evaluateCategoryIntent(proposedName, existingCategories = []) {
  const existingList = existingCategories.map((c) => ({ name: c.name, slug: c.slug, parentSlug: c.parentSlug }));

  const systemInstruction = `You are a taxonomy and information architecture expert for a global software and web directory.
Your role is to analyze a proposed category name, evaluate its semantic meaning, identify synonyms, and place it in the optimal hierarchy without creating near-duplicate categories.`;

  const prompt = `Analyze this proposed category name: "${proposedName}".

Existing Categories in the directory:
${JSON.stringify(existingList.slice(0, 100))}

Output JSON schema:
{
  "isDuplicate": false, // true if an existing category already covers this identical concept
  "suggestedAction": "create_new | merge_into_existing",
  "matchedExistingSlug": null, // slug of existing category if isDuplicate is true
  "clarificationNote": "Brief note explaining the decision or distinction",
  "proposedCategory": {
    "name": "Properly Capitalized Category Name",
    "slug": "url-friendly-slug",
    "parentSlug": "parent-category-slug or null if top level",
    "description": "Clear 1-sentence scope description of what belongs in this category.",
    "synonyms": ["synonym1", "synonym2", "related term"],
    "icon": "Lucide icon name (e.g. Cpu, Code, Palette, Briefcase, Compass, FileText, Bot)",
    "searchQueries": ["search query 1", "search query 2"]
  }
}`;

  const result = await callGemini(prompt, systemInstruction);
  return result;
}

/**
 * Global trend discovery across the tech and web ecosystem.
 */
export async function discoverEmergingGlobalTrends(existingCategoryNames = []) {
  const prompt = `Identify 5 emerging digital software trends, newly prominent tool categories, or breakout web services in the tech and AI landscape that might not be fully covered by:
Existing: ${existingCategoryNames.slice(0, 40).join(', ')}.

Output JSON schema:
{
  "trends": [
    {
      "trendTitle": "Name of Trend / Tool Cluster",
      "description": "Why this represents a distinct emerging category or workflow",
      "recommendedCategory": {
        "name": "Category Name",
        "slug": "category-slug",
        "parentSlug": "ai-tools | creative-tools | dev-tools | business-productivity | education-research | entertainment-discovery",
        "description": "Concise description"
      },
      "sampleTools": [
        {
          "name": "Tool Name",
          "officialUrl": "https://example.com",
          "description": "One concise sentence describing primary utility.",
          "tags": ["tag1", "tag2"],
          "pricing": "freemium"
        }
      ]
    }
  ]
}`;

  return await callGemini(prompt);
}
