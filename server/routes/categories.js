import express from 'express';
import { getDB } from '../db/connection.js';
import { evaluateCategoryIntent } from '../services/geminiService.js';
import { startCategoryDiscoveryJob } from '../services/jobManager.js';

const router = express.Router();

// Cache for categories hierarchy & aggregated counts
let cachedCategoriesResponse = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 25000;

export function invalidateCategoriesCache() {
  cachedCategoriesResponse = null;
  cacheTimestamp = 0;
}

/**
 * GET /api/categories
 * Returns all categories organized into hierarchical trees with accurate resource counts.
 */
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedCategoriesResponse && (now - cacheTimestamp < CACHE_TTL_MS)) {
      return res.json(cachedCategoriesResponse);
    }

    const db = getDB();
    const [categories, countAgg, totalResourcesCount] = await Promise.all([
      db.collection('categories').find({}).sort({ order: 1, name: 1 }).toArray(),
      db.collection('resources').aggregate([
        { $unwind: '$categorySlugs' },
        { $group: { _id: '$categorySlugs', count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('resources').countDocuments({ status: { $ne: 'broken' } }),
    ]);

    const countMap = new Map();
    countAgg.forEach((item) => {
      countMap.set(item._id, item.count);
    });

    // Map into hierarchical parent -> children structure
    const topLevel = categories.filter((c) => !c.parentSlug);
    const childrenMap = new Map();

    categories.forEach((c) => {
      // Direct count of tools tagged with this slug
      c.resourceCount = countMap.get(c.slug) || 0;

      if (c.parentSlug) {
        if (!childrenMap.has(c.parentSlug)) {
          childrenMap.set(c.parentSlug, []);
        }
        childrenMap.get(c.parentSlug).push(c);
      }
    });

    const hierarchy = topLevel.map((parent) => {
      const subs = childrenMap.get(parent.slug) || [];
      const subTotal = subs.reduce((sum, s) => sum + (s.resourceCount || 0), 0);
      const parentTotal = (countMap.get(parent.slug) || 0) + subTotal;

      return {
        ...parent,
        resourceCount: parentTotal,
        subcategories: subs,
      };
    });

    const responseData = {
      success: true,
      count: categories.length,
      totalResourcesCount,
      categories: hierarchy,
      flatList: categories,
    };

    cachedCategoriesResponse = responseData;
    cacheTimestamp = now;

    res.json(responseData);
  } catch (err) {
    console.error('[CategoriesRoute] GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/categories/:slug
 * Retrieves single category and its breadcrumb hierarchy.
 */
router.get('/:slug', async (req, res) => {
  try {
    const db = getDB();
    const slug = req.params.slug;
    const category = await db.collection('categories').findOne({ slug });

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Build breadcrumbs
    const breadcrumbs = [{ name: 'Directory', slug: '' }];
    if (category.parentSlug) {
      const parent = await db.collection('categories').findOne({ slug: category.parentSlug });
      if (parent) {
        breadcrumbs.push({ name: parent.name, slug: parent.slug });
      }
    }
    breadcrumbs.push({ name: category.name, slug: category.slug });

    // Fetch subcategories if this is a parent category
    const subcategories = await db.collection('categories').find({ parentSlug: category.slug }).sort({ name: 1 }).toArray();

    res.json({
      success: true,
      category,
      breadcrumbs,
      subcategories,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/categories/evaluate
 * Evaluates a proposed category name using Gemini to detect duplicates, suggest synonyms & hierarchy.
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }

    const db = getDB();
    const existing = await db.collection('categories').find({}).toArray();

    // Check exact name match first
    const cleanProposed = name.trim().toLowerCase();
    const directMatch = existing.find(
      (c) => c.name.toLowerCase() === cleanProposed || (c.synonyms && c.synonyms.includes(cleanProposed))
    );

    if (directMatch) {
      return res.json({
        success: true,
        evaluation: {
          isDuplicate: true,
          suggestedAction: 'merge_into_existing',
          matchedExistingSlug: directMatch.slug,
          matchedCategoryName: directMatch.name,
          clarificationNote: `An identical or synonymous category "${directMatch.name}" already exists.`,
          proposedCategory: directMatch,
        },
      });
    }

    // Call Gemini AI taxonomy evaluation
    const evaluation = await evaluateCategoryIntent(name.trim(), existing);
    res.json({ success: true, evaluation });
  } catch (err) {
    console.error('[CategoriesRoute] Evaluate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/categories
 * Creates a new category and optionally initiates AI tool discovery immediately.
 */
router.post('/', async (req, res) => {
  try {
    const { name, parentSlug, description, synonyms = [], icon = 'Folder', fetchWebsitesImmediately = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }

    const db = getDB();
    const categoriesCollection = db.collection('categories');

    // Generate URL-friendly slug
    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for collision
    const existing = await categoriesCollection.findOne({ slug: baseSlug });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Category with slug "${baseSlug}" already exists.`,
        category: existing,
      });
    }

    const newCategory = {
      name: name.trim(),
      slug: baseSlug,
      parentSlug: parentSlug || null,
      description: description?.trim() || `${name.trim()} websites, apps, and digital resources.`,
      synonyms: Array.from(new Set([name.toLowerCase(), ...(synonyms || []).map((s) => s.toLowerCase())])),
      icon: icon || 'Sparkles',
      order: 100,
      resourceCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastDiscoveryAt: null,
    };

    const insertResult = await categoriesCollection.insertOne(newCategory);
    invalidateCategoriesCache();

    let discoveryJob = null;
    if (fetchWebsitesImmediately) {
      discoveryJob = await startCategoryDiscoveryJob({
        categorySlug: newCategory.slug,
        targetCount: 100,
        triggerSource: 'new_category_init',
      });
    }

    res.status(201).json({
      success: true,
      category: { ...newCategory, _id: insertResult.insertedId },
      discoveryJob,
    });
  } catch (err) {
    console.error('[CategoriesRoute] POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/categories/:slug
 * Deletes a category and any nested subcategories after confirmation.
 * CRITICAL PHILOSOPHY: All resources are permanently preserved in MongoDB.
 * The deleted slug is safely unlinked from resources' categorySlugs array.
 */
router.delete('/:slug', async (req, res) => {
  try {
    const db = getDB();
    const slug = req.params.slug;
    const categoriesCollection = db.collection('categories');
    const resourcesCollection = db.collection('resources');
    const auditCollection = db.collection('audit_logs');

    const category = await categoriesCollection.findOne({ slug });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found.' });
    }

    // Find any subcategories
    const childCategories = await categoriesCollection.find({ parentSlug: slug }).toArray();
    const allSlugsToDelete = [slug, ...childCategories.map((c) => c.slug)];

    // 1. Remove the category slugs from all resources (PRESERVE ALL TOOLS IN DATABASE)
    const updateResult = await resourcesCollection.updateMany(
      { categorySlugs: { $in: allSlugsToDelete } },
      { $pull: { categorySlugs: { $in: allSlugsToDelete } } }
    );

    // 2. Remove the categories from categories collection
    await categoriesCollection.deleteMany({ slug: { $in: allSlugsToDelete } });
    invalidateCategoriesCache();

    // 3. Record audit log
    await auditCollection.insertOne({
      action: 'category_deleted',
      categorySlug: slug,
      categoryName: category.name,
      deletedSubcategories: childCategories.map((c) => c.name),
      affectedResourcesCount: updateResult.modifiedCount,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Category "${category.name}" ${childCategories.length > 0 ? `and ${childCategories.length} subcategories ` : ''}deleted successfully. All ${updateResult.modifiedCount} affected resources remain permanently preserved in the database.`,
      deletedSlugs: allSlugsToDelete,
    });
  } catch (err) {
    console.error('[CategoriesRoute] DELETE error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

