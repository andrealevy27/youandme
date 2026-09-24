import type { SkillCategory } from "@/lib/domain";

/** Reference taxonomies — safe to seed in every environment. */
export const SKILLS: { slug: string; name: string; category: SkillCategory }[] = [
  // engineering
  { slug: "full-stack", name: "Full-stack development", category: "engineering" },
  { slug: "backend", name: "Backend engineering", category: "engineering" },
  { slug: "frontend", name: "Frontend engineering", category: "engineering" },
  { slug: "mobile", name: "Mobile development", category: "engineering" },
  { slug: "infrastructure", name: "Cloud infrastructure", category: "engineering" },
  { slug: "security", name: "Security engineering", category: "engineering" },
  { slug: "hardware", name: "Hardware engineering", category: "engineering" },
  { slug: "data-engineering", name: "Data engineering", category: "engineering" },
  // ai
  { slug: "machine-learning", name: "Machine learning", category: "ai_ml" },
  { slug: "llm-apps", name: "LLM applications", category: "ai_ml" },
  { slug: "computer-vision", name: "Computer vision", category: "ai_ml" },
  { slug: "data-science", name: "Data science", category: "ai_ml" },
  { slug: "nlp", name: "NLP", category: "ai_ml" },
  // design
  { slug: "product-design", name: "Product design", category: "design" },
  { slug: "ux-research", name: "UX research", category: "design" },
  { slug: "brand-design", name: "Brand design", category: "design" },
  { slug: "ui-design", name: "UI design", category: "design" },
  // product
  { slug: "product-management", name: "Product management", category: "product" },
  { slug: "product-strategy", name: "Product strategy", category: "product" },
  { slug: "user-interviews", name: "Customer discovery", category: "product" },
  // growth
  { slug: "growth-marketing", name: "Growth marketing", category: "growth" },
  { slug: "performance-marketing", name: "Paid acquisition", category: "growth" },
  { slug: "content-marketing", name: "Content marketing", category: "growth" },
  { slug: "social-media", name: "Social & TikTok", category: "growth" },
  { slug: "seo", name: "SEO", category: "growth" },
  { slug: "community", name: "Community building", category: "growth" },
  // sales
  { slug: "b2b-sales", name: "B2B sales", category: "sales" },
  { slug: "partnerships", name: "Partnerships", category: "sales" },
  { slug: "customer-success", name: "Customer success", category: "sales" },
  // business
  { slug: "business-strategy", name: "Business strategy", category: "business" },
  { slug: "go-to-market", name: "Go-to-market", category: "business" },
  { slug: "market-research", name: "Market research", category: "business" },
  // finance
  { slug: "fundraising", name: "Fundraising", category: "finance" },
  { slug: "financial-modeling", name: "Financial modeling", category: "finance" },
  { slug: "pitch-decks", name: "Pitch decks", category: "finance" },
  // legal
  { slug: "startup-law", name: "Startup law", category: "legal" },
  { slug: "ip", name: "Intellectual property", category: "legal" },
  // operations
  { slug: "operations", name: "Operations", category: "operations" },
  { slug: "hiring", name: "Recruiting & hiring", category: "operations" },
  { slug: "supply-chain", name: "Supply chain", category: "operations" },
  // domain
  { slug: "healthcare", name: "Healthcare domain", category: "domain" },
  { slug: "fintech-domain", name: "Financial services domain", category: "domain" },
  { slug: "education-domain", name: "Education domain", category: "domain" },
  { slug: "climate-domain", name: "Climate & energy domain", category: "domain" },
];

export const INDUSTRIES = [
  "AI",
  "Health",
  "Fintech",
  "Climate",
  "Education",
  "Consumer",
  "B2B SaaS",
  "Developer tools",
  "Marketplaces",
  "Creator economy",
  "Future of work",
  "Biotech",
  "Robotics",
  "Commerce",
  "Media",
  "Real estate",
  "Mobility",
  "Security",
  "Gaming",
  "Social impact",
].map((name) => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }));

export const CONSULTANT_CATEGORIES: { slug: string; name: string; description: string; keywords: string[] }[] = [
  { slug: "growth", name: "Growth", description: "Acquisition, activation and retention loops.", keywords: ["growth", "acquisition", "retention", "activation", "funnel", "users", "tiktok", "viral"] },
  { slug: "marketing", name: "Marketing", description: "Positioning, content, paid and social.", keywords: ["marketing", "content", "social", "tiktok", "instagram", "ads", "paid", "seo", "launch"] },
  { slug: "branding", name: "Branding", description: "Identity, naming and visual systems.", keywords: ["brand", "branding", "logo", "identity", "naming", "visual"] },
  { slug: "product", name: "Product", description: "Roadmaps, discovery and prioritization.", keywords: ["product", "roadmap", "discovery", "prioritization", "pm", "mvp"] },
  { slug: "ux-ui", name: "UX/UI", description: "Research, onboarding and interface design.", keywords: ["ux", "ui", "design", "onboarding", "redesign", "figma", "usability"] },
  { slug: "software-development", name: "Software development", description: "Web, mobile and backend engineering.", keywords: ["developer", "engineering", "build", "app", "mvp", "backend", "frontend", "mobile", "code"] },
  { slug: "ai", name: "AI", description: "LLM apps, ML systems and AI strategy.", keywords: ["ai", "llm", "machine learning", "ml", "gpt", "model", "computer vision", "rag", "agents"] },
  { slug: "fundraising", name: "Fundraising", description: "Investor strategy, outreach and closing rounds.", keywords: ["fundraising", "raise", "investors", "vc", "seed", "pre-seed", "angel", "round"] },
  { slug: "finance", name: "Finance", description: "Models, budgets and unit economics.", keywords: ["finance", "financial model", "budget", "unit economics", "accounting", "cfo"] },
  { slug: "legal", name: "Legal", description: "Incorporation, contracts, equity and IP.", keywords: ["legal", "lawyer", "incorporation", "equity", "contract", "ip", "trademark", "safe"] },
  { slug: "business-strategy", name: "Business strategy", description: "Market entry, positioning and planning.", keywords: ["strategy", "business model", "market entry", "positioning", "planning"] },
  { slug: "sales", name: "Sales", description: "Pipeline, outbound and enterprise deals.", keywords: ["sales", "outbound", "pipeline", "b2b", "enterprise", "closing", "crm"] },
  { slug: "operations", name: "Operations", description: "Processes, tooling and scaling ops.", keywords: ["operations", "ops", "process", "logistics", "tooling"] },
  { slug: "hiring", name: "Hiring", description: "First hires, recruiting and team design.", keywords: ["hiring", "recruiting", "talent", "first hire", "team"] },
  { slug: "pitch-decks", name: "Pitch decks", description: "Narrative, design and investor materials.", keywords: ["pitch deck", "deck", "narrative", "investor materials", "storytelling"] },
  { slug: "market-research", name: "Market research", description: "Sizing, competitive analysis and validation.", keywords: ["market research", "validation", "tam", "competitors", "survey", "validate"] },
  { slug: "startup-coaching", name: "Startup coaching", description: "Founder coaching and accountability.", keywords: ["coaching", "coach", "founder", "mentor", "accountability", "leadership"] },
];
