import { connectDB, closeDB } from './connection.js';
import { ensureIndexes } from './indexes.js';
import { upsertResource } from '../services/deduplicator.js';
import { verifyWebsite } from '../services/verifier.js';

const SEED_CATEGORIES = [
  // 1. AI and Intelligent Tools
  {
    name: 'AI and Intelligent Tools',
    slug: 'ai-tools',
    parentSlug: null,
    description: 'Autonomous agents, foundation models, machine intelligence, and generative AI systems.',
    icon: 'Bot',
    order: 1,
  },
  { name: 'General AI Assistants', slug: 'general-ai-assistants', parentSlug: 'ai-tools', description: 'Conversational LLMs and multimodal AI assistants for everyday tasks.', icon: 'MessageSquare' },
  { name: 'AI Search Engines', slug: 'ai-search-engines', parentSlug: 'ai-tools', description: 'Grounded web discovery, direct answers, and generative search systems.', icon: 'Search' },
  { name: 'AI Agents', slug: 'ai-agents', parentSlug: 'ai-tools', description: 'Autonomous agents that execute complex multi-step workflows and tasks.', icon: 'Zap' },
  { name: 'AI Coding Assistants', slug: 'ai-coding-assistants', parentSlug: 'ai-tools', description: 'AI IDEs, code generation, refactoring, and automated review companions.', icon: 'Code' },
  { name: 'Vibe Coding', slug: 'vibe-coding', parentSlug: 'ai-tools', description: 'Natural language-driven software creation and rapid prompt-to-app prototyping.', icon: 'Wand2' },
  { name: 'AI UI Generators', slug: 'ai-ui-generators', parentSlug: 'ai-tools', description: 'Generate production frontend UI components and interfaces from prompts.', icon: 'Layout' },
  { name: 'AI Video Generators', slug: 'ai-video-generators', parentSlug: 'ai-tools', description: 'Generative text-to-video, image-to-video, and cinematic motion synthesis.', icon: 'Video' },
  { name: 'AI Image Generators', slug: 'ai-image-generators', parentSlug: 'ai-tools', description: 'High-fidelity text-to-image synthesis and visual generative models.', icon: 'Image' },
  { name: 'AI Audio & Music Tools', slug: 'ai-audio-music', parentSlug: 'ai-tools', description: 'Synthetic voice, music composition, speech-to-text, and audio enhancement.', icon: 'Music' },
  { name: 'AI Writing Assistants', slug: 'ai-writing-assistants', parentSlug: 'ai-tools', description: 'Grammar enhancement, prose drafting, copywriting, and structured summarization.', icon: 'FileText' },
  { name: 'AI Research Assistants', slug: 'ai-research-assistants', parentSlug: 'ai-tools', description: 'Academic paper synthesis, citation graph discovery, and literature review AI.', icon: 'BookOpen' },
  { name: 'AI Resume Builders', slug: 'ai-resume-builders', parentSlug: 'ai-tools', description: 'ATS-optimized resume generation, tailoring, and career document design.', icon: 'Briefcase' },

  // 2. Creative and Design Tools
  {
    name: 'Creative and Design Tools',
    slug: 'creative-design',
    parentSlug: null,
    description: 'Interface design, visual arts, motion graphics, 3D modeling, and digital creative suites.',
    icon: 'Palette',
    order: 2,
  },
  { name: 'UI & Interface Design', slug: 'ui-design', parentSlug: 'creative-design', description: 'Vector interface design, wireframing, component libraries, and screen layouts.', icon: 'Monitor' },
  { name: 'UI/UX Prototyping', slug: 'ui-ux-prototyping', parentSlug: 'creative-design', description: 'Interactive click-through prototypes, micro-interactions, and usability testing.', icon: 'Layers' },
  { name: 'Graphic Design', slug: 'graphic-design', parentSlug: 'creative-design', description: 'Layout design, marketing collateral, social assets, and vector creation.', icon: 'PenTool' },
  { name: 'Photo & Layer Editing', slug: 'photo-editing', parentSlug: 'creative-design', description: 'In-browser raster image editing, layer composition, and photo retouching.', icon: 'Camera' },
  { name: '3D Modeling & Animation', slug: '3d-modeling', parentSlug: 'creative-design', description: 'WebGL 3D sculpting, procedural rendering, and skeletal motion rigging.', icon: 'Box' },
  { name: 'Human-Computer Interaction', slug: 'hci-resources', parentSlug: 'creative-design', description: 'Design guidelines, accessibility patterns, and empirical interaction research.', icon: 'Users' },

  // 3. Development and Computer Science
  {
    name: 'Development and Computer Science',
    slug: 'development-cs',
    parentSlug: null,
    description: 'Engineering tools, developer platforms, databases, APIs, and cloud infrastructure.',
    icon: 'Terminal',
    order: 3,
  },
  { name: 'Web Development', slug: 'web-development', parentSlug: 'development-cs', description: 'Modern web frameworks, frontend toolchains, and client runtime utilities.', icon: 'Globe' },
  { name: 'Databases & Storage', slug: 'databases', parentSlug: 'development-cs', description: 'Relational databases, document stores, vector databases, and cache layers.', icon: 'Database' },
  { name: 'APIs & Backend Platforms', slug: 'apis-backend', parentSlug: 'development-cs', description: 'REST, GraphQL, and serverless backend execution environments.', icon: 'Server' },
  { name: 'DevOps & Cloud Infrastructure', slug: 'devops-cloud', parentSlug: 'development-cs', description: 'Container orchestration, CI/CD deployment pipelines, and cloud hosting.', icon: 'Cloud' },
  { name: 'Open-Source Utilities', slug: 'open-source-software', parentSlug: 'development-cs', description: 'Free and open-source developer toolkits, libraries, and CLI utilities.', icon: 'GitBranch' },
  { name: 'Computer Science Education', slug: 'cs-education', parentSlug: 'development-cs', description: 'Algorithms, data structures, interactive coding, and systems references.', icon: 'GraduationCap' },

  // 4. Business and Productivity
  {
    name: 'Business and Productivity',
    slug: 'business-productivity',
    parentSlug: null,
    description: 'Workflow management, document authoring, automation, and operational software.',
    icon: 'Briefcase',
    order: 4,
  },
  { name: 'Note-Taking & Knowledge Bases', slug: 'note-taking', parentSlug: 'business-productivity', description: 'Connected digital notebooks, markdown wikis, and second-brain systems.', icon: 'Bookmark' },
  { name: 'Project & Task Management', slug: 'project-management', parentSlug: 'business-productivity', description: 'Agile issue trackers, team sprint boards, and timeline roadmaps.', icon: 'CheckSquare' },
  { name: 'Workflow Automation', slug: 'workflow-automation', parentSlug: 'business-productivity', description: 'No-code integration connectors, webhooks, and multi-app automations.', icon: 'Cpu' },
  { name: 'Spreadsheets & Data Tables', slug: 'spreadsheets', parentSlug: 'business-productivity', description: 'Modern tabular databases, formula engines, and financial sheets.', icon: 'Table' },
  { name: 'Online Utilities & Converters', slug: 'online-utilities', parentSlug: 'business-productivity', description: 'In-browser file format converters, regex debuggers, and formatting tools.', icon: 'Sliders' },

  // 5. Education, Research, and Learning
  {
    name: 'Education and Research',
    slug: 'education-research',
    parentSlug: null,
    description: 'Scientific computational engines, open libraries, and specialized learning hubs.',
    icon: 'GraduationCap',
    order: 5,
  },
  { name: 'Academic & Scientific Research', slug: 'academic-research', parentSlug: 'education-research', description: 'Paper discovery, arXiv readers, data repositories, and citation managers.', icon: 'BookOpen' },
  { name: 'Interactive Learning Platforms', slug: 'learning-platforms', parentSlug: 'education-research', description: 'Guided interactive courses, computer science playgrounds, and labs.', icon: 'Award' },

  // 6. Entertainment and Discovery
  {
    name: 'Entertainment and Discovery',
    slug: 'entertainment-discovery',
    parentSlug: null,
    description: 'Creative web experiments, interactive curiosities, browser games, and digital art.',
    icon: 'Sparkles',
    order: 6,
  },
  { name: 'Creative Web Experiences', slug: 'creative-web-experiences', parentSlug: 'entertainment-discovery', description: 'Interactive browser canvas art, WebGL showcases, and internet curiosities.', icon: 'Compass' },
  { name: 'Browser-Based Games', slug: 'browser-games', parentSlug: 'entertainment-discovery', description: 'Instant playable web games running directly in your browser without installs.', icon: 'Gamepad2' },
];

const SEED_RESOURCES = [
  // AI Coding & Vibe Coding
  {
    name: 'Cursor',
    officialUrl: 'https://www.cursor.com',
    description: 'AI-first code editor built for rapid pair programming and codebase queries.',
    categorySlugs: ['ai-coding-assistants', 'vibe-coding', 'web-development'],
    tags: ['code-editor', 'ai', 'developer-tools', 'vscode-fork'],
    pricing: 'freemium',
    qualityScore: 96,
    trendScore: 98,
  },
  {
    name: 'v0 by Vercel',
    officialUrl: 'https://v0.dev',
    description: 'Generative UI system that transforms natural language prompts into React Tailwind code.',
    categorySlugs: ['ai-ui-generators', 'vibe-coding', 'ui-design'],
    tags: ['generative-ui', 'react', 'tailwind', 'frontend'],
    pricing: 'freemium',
    qualityScore: 94,
    trendScore: 95,
  },
  {
    name: 'GitHub Copilot',
    officialUrl: 'https://github.com/features/copilot',
    description: 'Cloud-based AI pair programmer providing code completions and multi-file refactoring.',
    categorySlugs: ['ai-coding-assistants'],
    tags: ['ai-assistant', 'coding', 'github', 'autocompletion'],
    pricing: 'paid',
    qualityScore: 93,
    trendScore: 88,
  },

  // General AI & Search
  {
    name: 'Perplexity AI',
    officialUrl: 'https://www.perplexity.ai',
    description: 'Conversational answer engine delivering grounded search results with inline citations.',
    categorySlugs: ['ai-search-engines', 'general-ai-assistants'],
    tags: ['search', 'citations', 'research', 'llm'],
    pricing: 'freemium',
    qualityScore: 95,
    trendScore: 96,
  },
  {
    name: 'ChatGPT',
    officialUrl: 'https://chatgpt.com',
    description: 'Conversational foundation model for reasoning, text generation, and data analysis.',
    categorySlugs: ['general-ai-assistants', 'ai-writing-assistants'],
    tags: ['llm', 'chat', 'general-ai', 'openai'],
    pricing: 'freemium',
    qualityScore: 97,
    trendScore: 94,
  },
  {
    name: 'Claude',
    officialUrl: 'https://claude.ai',
    description: 'Nuanced AI assistant specialized in deep document analysis, long-context writing, and code.',
    categorySlugs: ['general-ai-assistants', 'ai-writing-assistants', 'ai-coding-assistants'],
    tags: ['anthropic', 'large-context', 'reasoning', 'coding'],
    pricing: 'freemium',
    qualityScore: 96,
    trendScore: 95,
  },

  // Creative & Design
  {
    name: 'Figma',
    officialUrl: 'https://www.figma.com',
    description: 'Collaborative interface design, vector editing, and interactive prototyping platform.',
    categorySlugs: ['ui-design', 'ui-ux-prototyping', 'graphic-design'],
    tags: ['ui-design', 'prototyping', 'collaboration', 'vector'],
    pricing: 'freemium',
    qualityScore: 99,
    trendScore: 92,
  },
  {
    name: 'Photopea',
    officialUrl: 'https://www.photopea.com',
    description: 'Advanced raster and vector image editor operating entirely in your web browser.',
    categorySlugs: ['photo-editing', 'graphic-design'],
    tags: ['photoshop-alternative', 'browser-editor', 'psd', 'photo'],
    pricing: 'free',
    qualityScore: 95,
    trendScore: 90,
  },
  {
    name: 'Excalidraw',
    officialUrl: 'https://excalidraw.com',
    description: 'Virtual collaborative whiteboard for sketching hand-drawn style diagrams.',
    categorySlugs: ['ui-ux-prototyping', 'open-source-software'],
    tags: ['whiteboard', 'diagrams', 'open-source', 'hand-drawn'],
    pricing: 'free',
    qualityScore: 96,
    trendScore: 91,
  },
  {
    name: 'Runway',
    officialUrl: 'https://runwayml.com',
    description: 'Applied AI research platform offering generative video creation and cinematic motion tools.',
    categorySlugs: ['ai-video-generators'],
    tags: ['video-generation', 'gen-3', 'cinematic', 'multimodal'],
    pricing: 'freemium',
    qualityScore: 93,
    trendScore: 94,
  },
  {
    name: 'Midjourney',
    officialUrl: 'https://www.midjourney.com',
    description: 'Generative image model renowned for artistic rendering and photo-realistic aesthetics.',
    categorySlugs: ['ai-image-generators'],
    tags: ['text-to-image', 'digital-art', 'creative', 'generation'],
    pricing: 'paid',
    qualityScore: 95,
    trendScore: 92,
  },

  // Productivity & Business
  {
    name: 'Linear',
    officialUrl: 'https://linear.app',
    description: 'Purpose-built issue tracker and product planning tool built for high-velocity software teams.',
    categorySlugs: ['project-management', 'business-productivity'],
    tags: ['issue-tracker', 'agile', 'fast', 'engineering'],
    pricing: 'freemium',
    qualityScore: 97,
    trendScore: 93,
  },
  {
    name: 'Notion',
    officialUrl: 'https://www.notion.so',
    description: 'Connected workspace combining notes, collaborative docs, wikis, and relational databases.',
    categorySlugs: ['note-taking', 'business-productivity'],
    tags: ['notes', 'knowledge-base', 'wiki', 'productivity'],
    pricing: 'freemium',
    qualityScore: 96,
    trendScore: 90,
  },
  {
    name: 'Obsidian',
    officialUrl: 'https://obsidian.md',
    description: 'Extensible knowledge base operating over a local folder of plain text Markdown files.',
    categorySlugs: ['note-taking', 'business-productivity'],
    tags: ['local-first', 'markdown', 'knowledge-graph', 'privacy'],
    pricing: 'free',
    qualityScore: 98,
    trendScore: 93,
  },

  // Developer & Infrastructure
  {
    name: 'Supabase',
    officialUrl: 'https://supabase.com',
    description: 'Open source Firebase alternative providing Postgres, Auth, real-time subscriptions, and storage.',
    categorySlugs: ['databases', 'apis-backend', 'open-source-software'],
    tags: ['postgres', 'backend', 'open-source', 'database'],
    pricing: 'freemium',
    qualityScore: 97,
    trendScore: 95,
  },
  {
    name: 'Raycast',
    officialUrl: 'https://www.raycast.com',
    description: 'Blazingly fast, extendable launcher replacing Spotlight with scripts, window management, and AI.',
    categorySlugs: ['online-utilities', 'open-source-software'],
    tags: ['launcher', 'productivity', 'macos', 'developer-utilities'],
    pricing: 'freemium',
    qualityScore: 98,
    trendScore: 94,
  },
  {
    name: 'Tailwind CSS',
    officialUrl: 'https://tailwindcss.com',
    description: 'Utility-first CSS framework for rapidly composing modern custom user interfaces.',
    categorySlugs: ['web-development', 'ui-design'],
    tags: ['css', 'frontend', 'styling', 'framework'],
    pricing: 'free',
    qualityScore: 98,
    trendScore: 91,
  },
  {
    name: 'shadcn/ui',
    officialUrl: 'https://ui.shadcn.com',
    description: 'Beautifully designed component collection copied directly into your codebase.',
    categorySlugs: ['ai-ui-generators', 'web-development', 'ui-design'],
    tags: ['react', 'radix-ui', 'tailwind', 'components'],
    pricing: 'free',
    qualityScore: 99,
    trendScore: 97,
  },

  // Education & Research
  {
    name: 'Connected Papers',
    officialUrl: 'https://www.connectedpapers.com',
    description: 'Visual graph tool to discover, explore, and map related academic research papers.',
    categorySlugs: ['academic-research', 'ai-research-assistants'],
    tags: ['academic', 'graph', 'citation-map', 'research'],
    pricing: 'freemium',
    qualityScore: 95,
    trendScore: 89,
  },
  {
    name: 'Hugging Face',
    officialUrl: 'https://huggingface.co',
    description: 'Open collaborative platform to discover, run, and fine-tune machine learning models and datasets.',
    categorySlugs: ['development-cs', 'open-source-software', 'ai-tools'],
    tags: ['machine-learning', 'models', 'datasets', 'transformers'],
    pricing: 'freemium',
    qualityScore: 98,
    trendScore: 96,
  },
];

export async function seedDatabase() {
  const { db } = await connectDB();
  await ensureIndexes(db);

  const categoriesCollection = db.collection('categories');
  console.log('[Seed] Seeding hierarchical categories...');

  for (const cat of SEED_CATEGORIES) {
    const existing = await categoriesCollection.findOne({ slug: cat.slug });
    if (!existing) {
      await categoriesCollection.insertOne({
        ...cat,
        synonyms: [cat.name.toLowerCase(), cat.slug],
        resourceCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastDiscoveryAt: null,
      });
    } else {
      await categoriesCollection.updateOne(
        { slug: cat.slug },
        {
          $set: {
            name: cat.name,
            parentSlug: cat.parentSlug,
            description: cat.description,
            icon: cat.icon,
            order: cat.order || existing.order || 50,
          },
        }
      );
    }
  }

  console.log(`[Seed] Seeded ${SEED_CATEGORIES.length} categories.`);

  console.log('[Seed] Seeding verified baseline resources...');
  let added = 0;
  for (const item of SEED_RESOURCES) {
    const primaryCategory = item.categorySlugs[0];
    const verification = await verifyWebsite(item.officialUrl, 4000);
    const result = await upsertResource(db, item, primaryCategory, verification);
    if (result.action === 'inserted') added++;
  }

  // Update resource counts on categories
  const resourcesCollection = db.collection('resources');
  for (const cat of SEED_CATEGORIES) {
    const count = await resourcesCollection.countDocuments({ categorySlugs: cat.slug });
    await categoriesCollection.updateOne({ slug: cat.slug }, { $set: { resourceCount: count } });
  }

  console.log(`[Seed] Database seed completed! Inserted ${added} baseline verified tools.`);
}

// Run directly if invoked from command line
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Failed:', err);
      await closeDB();
      process.exit(1);
    });
}

