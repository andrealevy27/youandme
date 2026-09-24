import type { DimensionKey } from "@/lib/personality";

/**
 * DEVELOPMENT DEMO DATA. Every record created from this file is flagged `is_demo`
 * and rendered with a "Demo" badge. Never seeded when NODE_ENV=production.
 * Emails use the reserved demo domain so they can never collide with real users.
 */
export const DEMO_DOMAIN = "demo.youandme.app";
export const DEMO_PASSWORD = "demo-password-123";

type P = Partial<Record<DimensionKey, number>>;

export type DemoPerson = {
  key: string;
  name: string;
  headline: string;
  bio: string;
  city: string;
  country: string;
  timezone: string;
  university?: string;
  currentRole?: string;
  currentCompany?: string;
  roles: string[];
  intents: string[];
  skills: [string, number][];
  industries: string[];
  lookingForCofounder?: boolean;
  cofounderTypes?: string[];
  stages?: string[];
  commitment?: "exploring" | "part_time" | "full_time_soon" | "full_time";
  availability?: "full_time" | "part_time" | "nights_weekends" | "limited";
  workMode?: "remote" | "hybrid" | "in_person" | "flexible";
  ambition?: "venture_scale" | "profitable_independent" | "impact" | "open";
  founderExperience?: "first_time" | "previous_founder" | "serial" | "exited";
  years?: number;
  lookingFor?: string;
  linkedin?: boolean;
  personality?: P;
  experience?: { title: string; company: string; start: number; end?: number }[];
};

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    key: "lisa", name: "Lisa Moreno", headline: "Building calmer care coordination for families",
    bio: "Former operations lead at a home-care network. I've seen how much time families lose coordinating care across providers — building the tool I wish we had.",
    city: "New York", country: "United States", timezone: "America/New_York", university: "Columbia University",
    currentRole: "Founder", currentCompany: "Kinwell", roles: ["founder"], intents: ["building", "cofounder"],
    skills: [["operations", 3], ["go-to-market", 2], ["user-interviews", 2], ["healthcare", 3]], industries: ["Health", "AI", "Consumer"],
    lookingForCofounder: true, cofounderTypes: ["technical"], stages: ["validation", "prototype"], commitment: "full_time", availability: "full_time",
    workMode: "hybrid", ambition: "venture_scale", founderExperience: "first_time", years: 9, linkedin: true,
    lookingFor: "A technical cofounder who can own the product end to end and cares about healthcare.",
    personality: { vision_operator: -40, pace: -30, structure: -35, autonomy: 30, risk: -20, communication: -40, focus: -50 },
    experience: [{ title: "Head of Operations", company: "CareBridge Home Health", start: 2019, end: 2025 }],
  },
  {
    key: "sarah", name: "Sarah Chen", headline: "ML engineer looking for an early-stage founding role",
    bio: "4 years building ML systems for clinical imaging. I want to join as a founding engineer or technical cofounder on something in health.",
    city: "New York", country: "United States", timezone: "America/New_York", university: "NYU",
    currentRole: "Machine Learning Engineer", currentCompany: "Radiant Labs", roles: ["cofounder_candidate", "talent"], intents: ["cofounder", "join"],
    skills: [["machine-learning", 3], ["computer-vision", 3], ["backend", 2], ["llm-apps", 2]], industries: ["Health", "AI", "Biotech"],
    lookingForCofounder: true, cofounderTypes: ["business"], stages: ["idea", "validation", "prototype"], commitment: "full_time", availability: "full_time",
    workMode: "hybrid", ambition: "venture_scale", founderExperience: "first_time", years: 4, linkedin: true,
    lookingFor: "A business cofounder with deep healthcare distribution experience.",
    personality: { vision_operator: 45, pace: -20, structure: -30, autonomy: 10, risk: -10, communication: -30, focus: 55 },
    experience: [{ title: "ML Engineer", company: "Radiant Labs", start: 2021 }],
  },
  {
    key: "marcus", name: "Marcus Adeyemi", headline: "Full-stack engineer, two-time founder",
    bio: "Built and sold a scheduling tool for clinics. Looking for my next thing — happy to be the technical half of a strong team.",
    city: "Brooklyn", country: "United States", timezone: "America/New_York", university: "Georgia Tech",
    currentRole: "Staff Engineer", currentCompany: "Ledgerline", roles: ["cofounder_candidate", "founder"], intents: ["cofounder"],
    skills: [["full-stack", 3], ["backend", 3], ["infrastructure", 2], ["product-management", 1]], industries: ["Health", "Fintech", "B2B SaaS"],
    lookingForCofounder: true, cofounderTypes: ["business", "growth"], stages: ["validation", "mvp"], commitment: "full_time_soon", availability: "part_time",
    workMode: "remote", ambition: "venture_scale", founderExperience: "exited", years: 11, linkedin: true,
    lookingFor: "A commercial cofounder who loves selling and talking to customers.",
    personality: { vision_operator: 30, pace: -60, structure: 20, autonomy: -40, risk: -40, communication: -60, focus: 20 },
    experience: [{ title: "Cofounder & CTO", company: "Slotwise (acquired)", start: 2016, end: 2020 }, { title: "Staff Engineer", company: "Ledgerline", start: 2020 }],
  },
  {
    key: "priya", name: "Priya Raman", headline: "Product designer obsessed with onboarding",
    bio: "Designed onboarding flows used by millions at two consumer apps. Looking to cofound a consumer or health product where design is a real edge.",
    city: "San Francisco", country: "United States", timezone: "America/Los_Angeles", university: "Stanford University",
    currentRole: "Senior Product Designer", currentCompany: "Loop", roles: ["cofounder_candidate"], intents: ["cofounder", "join"],
    skills: [["product-design", 3], ["ux-research", 3], ["ui-design", 2], ["brand-design", 1]], industries: ["Consumer", "Health", "Education"],
    lookingForCofounder: true, cofounderTypes: ["technical", "business"], stages: ["idea", "validation"], commitment: "full_time_soon", availability: "part_time",
    workMode: "remote", ambition: "open", founderExperience: "first_time", years: 7,
    personality: { vision_operator: -20, pace: -10, structure: 30, autonomy: 50, risk: 10, communication: 40, focus: 60 },
  },
  {
    key: "daniel", name: "Daniel Okafor", headline: "Enterprise sales leader turned founder",
    bio: "Closed eight-figure contracts selling data infrastructure. Now exploring AI tooling for finance teams and looking for a technical partner.",
    city: "Chicago", country: "United States", timezone: "America/Chicago", university: "University of Michigan",
    currentRole: "Founder", currentCompany: "Stealth", roles: ["founder"], intents: ["building", "cofounder"],
    skills: [["b2b-sales", 3], ["partnerships", 2], ["go-to-market", 3], ["fundraising", 1]], industries: ["Fintech", "AI", "B2B SaaS"],
    lookingForCofounder: true, cofounderTypes: ["technical"], stages: ["idea", "validation"], commitment: "full_time", availability: "full_time",
    workMode: "hybrid", ambition: "venture_scale", founderExperience: "first_time", years: 12, linkedin: true,
    personality: { vision_operator: -50, pace: -70, structure: 40, autonomy: 20, risk: -60, communication: -70, focus: -40 },
  },
  {
    key: "elena", name: "Elena Petrova", headline: "AI researcher exploring applied LLM products",
    bio: "PhD in NLP. Built retrieval systems for legal research. Interested in climate and education applications of language models.",
    city: "Boston", country: "United States", timezone: "America/New_York", university: "MIT",
    currentRole: "Research Scientist", currentCompany: "Parallel AI", roles: ["cofounder_candidate"], intents: ["cofounder", "exploring"],
    skills: [["nlp", 3], ["llm-apps", 3], ["machine-learning", 3], ["data-science", 2]], industries: ["AI", "Climate", "Education"],
    lookingForCofounder: true, cofounderTypes: ["business", "product"], stages: ["idea", "prototype"], commitment: "part_time", availability: "nights_weekends",
    workMode: "remote", ambition: "impact", founderExperience: "first_time", years: 6,
    personality: { vision_operator: 20, pace: 50, structure: -20, autonomy: -50, risk: 30, communication: 30, focus: 40 },
  },
  {
    key: "jordan", name: "Jordan Blake", headline: "Growth marketer for consumer apps",
    bio: "Scaled two consumer apps from 0 to 1M users with TikTok and creator-led growth. Want to cofound something consumer-first.",
    city: "Los Angeles", country: "United States", timezone: "America/Los_Angeles", university: "UCLA",
    currentRole: "Head of Growth", currentCompany: "Fable Fitness", roles: ["cofounder_candidate"], intents: ["cofounder"],
    skills: [["growth-marketing", 3], ["social-media", 3], ["content-marketing", 2], ["community", 2]], industries: ["Consumer", "Creator economy", "Health"],
    lookingForCofounder: true, cofounderTypes: ["technical", "product"], stages: ["mvp", "pre_revenue"], commitment: "full_time", availability: "full_time",
    workMode: "in_person", ambition: "venture_scale", founderExperience: "previous_founder", years: 8,
    personality: { vision_operator: -60, pace: -80, structure: -60, autonomy: -30, risk: -70, communication: -50, focus: -60 },
  },
  {
    key: "amara", name: "Amara Nwosu", headline: "Backend engineer who wants to build in climate",
    bio: "Distributed systems at a large cloud provider. Spending nights on grid-optimization side projects and ready to go full-time on the right team.",
    city: "Toronto", country: "Canada", timezone: "America/Toronto", university: "University of Waterloo",
    currentRole: "Senior Software Engineer", currentCompany: "Northwind Cloud", roles: ["cofounder_candidate", "talent"], intents: ["cofounder", "join"],
    skills: [["backend", 3], ["infrastructure", 3], ["data-engineering", 2]], industries: ["Climate", "Developer tools"],
    lookingForCofounder: true, cofounderTypes: ["business", "domain_expert"], stages: ["idea", "validation", "prototype"], commitment: "full_time_soon", availability: "nights_weekends",
    workMode: "remote", ambition: "impact", founderExperience: "first_time", years: 6,
    personality: { vision_operator: 50, pace: 20, structure: -50, autonomy: -20, risk: 20, communication: 10, focus: 50 },
  },
  {
    key: "tomas", name: "Tomás Rivera", headline: "Fintech operator, ex-payments PM",
    bio: "Product lead for cross-border payments. Exploring tools that help immigrants build credit.",
    city: "Miami", country: "United States", timezone: "America/New_York", university: "University of Florida",
    currentRole: "Group Product Manager", currentCompany: "Payvio", roles: ["founder", "cofounder_candidate"], intents: ["building", "cofounder"],
    skills: [["product-management", 3], ["product-strategy", 2], ["fintech-domain", 3], ["user-interviews", 2]], industries: ["Fintech", "Social impact", "Consumer"],
    lookingForCofounder: true, cofounderTypes: ["technical"], stages: ["idea", "validation"], commitment: "part_time", availability: "part_time",
    workMode: "hybrid", ambition: "venture_scale", founderExperience: "first_time", years: 9,
    personality: { vision_operator: 0, pace: -20, structure: -10, autonomy: 20, risk: 0, communication: 10, focus: 0 },
  },
  {
    key: "hana", name: "Hana Suzuki", headline: "Mobile engineer & indie app maker",
    bio: "Shipped 6 iOS apps, two profitable. Want a business partner to turn one into a real company.",
    city: "Seattle", country: "United States", timezone: "America/Los_Angeles",
    currentRole: "Independent", roles: ["cofounder_candidate", "freelancer"], intents: ["cofounder"],
    skills: [["mobile", 3], ["frontend", 2], ["ui-design", 2]], industries: ["Consumer", "Education", "Gaming"],
    lookingForCofounder: true, cofounderTypes: ["growth", "business"], stages: ["mvp", "revenue"], commitment: "full_time", availability: "full_time",
    workMode: "remote", ambition: "profitable_independent", founderExperience: "previous_founder", years: 8,
    personality: { vision_operator: 30, pace: -50, structure: 30, autonomy: -60, risk: -20, communication: -20, focus: 40 },
  },
];

type Service = { title: string; description: string; pricingType: "fixed" | "hourly" | "package" | "recurring"; priceCents: number; durationMinutes: number; includes: string[]; category: string; billingInterval?: string };

export type DemoConsultant = DemoPerson & {
  consultant: {
    headline: string;
    categories: string[];
    hourlyRateCents: number;
    languages: string[];
    previousCompanies: string[];
    stagesServed: string[];
    services: Service[];
    /** weekday → [startHour, endHour] in consultant timezone */
    hours: Record<number, [number, number]>;
    portfolio?: { title: string; description: string }[];
  };
};

const weekdays = (start: number, end: number) => ({ 1: [start, end], 2: [start, end], 3: [start, end], 4: [start, end], 5: [start, end] }) as Record<number, [number, number]>;

export const DEMO_CONSULTANTS: DemoConsultant[] = [
  {
    key: "maya", name: "Maya Goldberg", headline: "Growth for consumer apps", bio: "Former growth lead at two consumer apps. I help early teams find their first repeatable acquisition channel — often TikTok and creators.",
    city: "New York", country: "United States", timezone: "America/New_York", roles: ["consultant"], intents: ["consult"],
    skills: [["growth-marketing", 3], ["social-media", 3], ["performance-marketing", 2]], industries: ["Consumer", "Creator economy"], years: 10,
    personality: { vision_operator: 20, pace: -60, structure: 30, autonomy: 20, risk: -30, communication: -60, focus: 10 },
    consultant: {
      headline: "TikTok & creator-led growth for consumer startups", categories: ["growth", "marketing"], hourlyRateCents: 20000, languages: ["English", "Hebrew"],
      previousCompanies: ["Fable Fitness", "Pollen"], stagesServed: ["mvp", "pre_revenue", "revenue"],
      services: [
        { title: "Growth Strategy Session", description: "90-minute growth audit and acquisition plan.", pricingType: "fixed", priceCents: 25000, durationMinutes: 90, includes: ["Pre-call questionnaire", "Strategy session", "Written recommendations"], category: "growth" },
        { title: "Monthly Growth Advisor", description: "Ongoing support to run and evaluate growth experiments.", pricingType: "recurring", priceCents: 150000, durationMinutes: 60, includes: ["4 calls per month", "Async support", "KPI review", "Growth experiments"], category: "growth", billingInterval: "month" },
      ],
      hours: weekdays(10, 17),
      portfolio: [{ title: "Creator program for a fitness app", description: "Designed a creator seeding program that became the app's top acquisition channel." }],
    },
  },
  {
    key: "raj", name: "Raj Patel", headline: "Fundraising strategy for pre-seed & seed", bio: "Ex-VC associate, now helping founders run tight, well-prepared raises.",
    city: "San Francisco", country: "United States", timezone: "America/Los_Angeles", roles: ["consultant", "advisor"], intents: ["consult", "advise"],
    skills: [["fundraising", 3], ["pitch-decks", 3], ["financial-modeling", 2]], industries: ["AI", "B2B SaaS", "Fintech"], years: 8,
    personality: { vision_operator: 10, pace: 10, structure: -40, autonomy: 30, risk: 20, communication: -20, focus: -10 },
    consultant: {
      headline: "Run a focused pre-seed or seed round", categories: ["fundraising", "pitch-decks", "finance"], hourlyRateCents: 30000, languages: ["English", "Hindi"],
      previousCompanies: ["Northstar Ventures"], stagesServed: ["validation", "mvp", "pre_revenue", "fundraising"],
      services: [
        { title: "Pitch Deck Teardown", description: "Line-by-line review of your deck and narrative with a rewrite plan.", pricingType: "fixed", priceCents: 40000, durationMinutes: 60, includes: ["Async deck review", "60-min session", "Annotated deck"], category: "pitch-decks" },
        { title: "Fundraising Hour", description: "Bring any fundraising question — targeting, terms, timing.", pricingType: "hourly", priceCents: 30000, durationMinutes: 60, includes: ["Live session", "Follow-up notes"], category: "fundraising" },
      ],
      hours: { 2: [9, 15], 3: [9, 15], 4: [9, 15] },
    },
  },
  {
    key: "sofia", name: "Sofia Lindqvist", headline: "UX/UI and onboarding redesigns", bio: "Product designer who has redesigned onboarding for 20+ startups. I focus on activation, not decoration.",
    city: "Stockholm", country: "Sweden", timezone: "Europe/Stockholm", roles: ["consultant", "freelancer"], intents: ["consult"],
    skills: [["product-design", 3], ["ux-research", 3], ["ui-design", 3]], industries: ["B2B SaaS", "Consumer", "Health"], years: 9,
    personality: { vision_operator: 30, pace: 30, structure: -30, autonomy: -20, risk: 10, communication: 40, focus: 60 },
    consultant: {
      headline: "Onboarding & activation redesigns", categories: ["ux-ui", "product"], hourlyRateCents: 15000, languages: ["English", "Swedish"],
      previousCompanies: ["Klarna", "Spotify"], stagesServed: ["mvp", "pre_revenue", "revenue", "growth"],
      services: [
        { title: "Onboarding Audit", description: "Heuristic review of your signup and first-run experience with prioritized fixes.", pricingType: "fixed", priceCents: 60000, durationMinutes: 60, includes: ["Recorded walkthrough", "Prioritized issues list", "60-min review call"], category: "ux-ui" },
        { title: "Design Sprint", description: "Two-week sprint to redesign one core flow, from research to high-fidelity prototype.", pricingType: "package", priceCents: 480000, durationMinutes: 60, includes: ["Kickoff workshop", "3 user interviews", "Figma prototype", "Handoff session"], category: "ux-ui" },
      ],
      hours: weekdays(9, 16),
    },
  },
  {
    key: "ben", name: "Ben Carter", headline: "Startup lawyer (formation, equity, SAFEs)", bio: "Startup attorney who helps founders set up clean foundations: incorporation, founder equity, SAFEs and IP assignment.",
    city: "Austin", country: "United States", timezone: "America/Chicago", roles: ["consultant", "advisor"], intents: ["consult"],
    skills: [["startup-law", 3], ["ip", 2]], industries: ["B2B SaaS", "AI", "Consumer"], years: 14,
    personality: { vision_operator: 60, pace: 60, structure: -60, autonomy: 20, risk: 70, communication: 30, focus: 70 },
    consultant: {
      headline: "Clean legal foundations for new startups", categories: ["legal"], hourlyRateCents: 35000, languages: ["English"],
      previousCompanies: ["Holloway & Grant LLP"], stagesServed: ["idea", "validation", "prototype", "mvp", "fundraising"],
      services: [
        { title: "Founder Legal Kickoff", description: "Incorporation, founder agreements and vesting walkthrough.", pricingType: "fixed", priceCents: 90000, durationMinutes: 60, includes: ["Entity recommendation", "Founder vesting plan", "Document checklist"], category: "legal" },
      ],
      hours: { 1: [11, 17], 3: [11, 17], 5: [11, 15] },
    },
  },
  {
    key: "aisha", name: "Aisha Rahman", headline: "AI product engineering", bio: "Built LLM features at a developer-tools company. I help startups ship reliable AI features: evals, retrieval, and agents.",
    city: "London", country: "United Kingdom", timezone: "Europe/London", roles: ["consultant", "freelancer"], intents: ["consult"],
    skills: [["llm-apps", 3], ["machine-learning", 2], ["backend", 3]], industries: ["AI", "Developer tools", "B2B SaaS"], years: 7,
    personality: { vision_operator: 40, pace: -30, structure: 0, autonomy: -40, risk: -10, communication: -30, focus: 50 },
    consultant: {
      headline: "Ship reliable LLM features", categories: ["ai", "software-development"], hourlyRateCents: 22000, languages: ["English", "Urdu"],
      previousCompanies: ["Stackwise"], stagesServed: ["prototype", "mvp", "pre_revenue", "revenue"],
      services: [
        { title: "AI Architecture Review", description: "Review your LLM stack, evals and costs; leave with a concrete plan.", pricingType: "fixed", priceCents: 50000, durationMinutes: 90, includes: ["Pre-read of your system", "90-min review", "Written architecture plan"], category: "ai" },
        { title: "Hands-on AI Engineering", description: "Hourly implementation help on your codebase.", pricingType: "hourly", priceCents: 22000, durationMinutes: 60, includes: ["Pairing or async PRs"], category: "software-development" },
      ],
      hours: weekdays(9, 17),
    },
  },
  {
    key: "carlos", name: "Carlos Mendes", headline: "B2B sales systems for first revenue", bio: "Built outbound teams at two seed-stage SaaS companies. I help founders close their first 10 customers themselves.",
    city: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon", roles: ["consultant"], intents: ["consult"],
    skills: [["b2b-sales", 3], ["go-to-market", 3], ["customer-success", 2]], industries: ["B2B SaaS", "Future of work"], years: 11,
    personality: { vision_operator: -10, pace: -40, structure: 40, autonomy: 30, risk: -30, communication: -50, focus: -20 },
    consultant: {
      headline: "Founder-led sales for your first customers", categories: ["sales", "business-strategy"], hourlyRateCents: 18000, languages: ["English", "Portuguese", "Spanish"],
      previousCompanies: ["Workly", "Pipefy"], stagesServed: ["mvp", "pre_revenue", "revenue"],
      services: [
        { title: "Outbound Playbook", description: "ICP, messaging and a 4-week outbound sequence tailored to your product.", pricingType: "package", priceCents: 200000, durationMinutes: 60, includes: ["ICP workshop", "Messaging & sequences", "2 follow-up calls"], category: "sales" },
      ],
      hours: weekdays(10, 18),
    },
  },
];

export type DemoStartup = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  problem: string;
  solution: string;
  stage: "idea" | "validation" | "prototype" | "mvp" | "pre_revenue" | "revenue" | "growth" | "fundraising";
  businessModel: string;
  location: string;
  workMode: "remote" | "hybrid" | "in_person" | "flexible";
  industries: string[];
  fundingStatus: "bootstrapped" | "not_raising" | "raising" | "pre_seed" | "seed" | "series_a_plus";
  traction?: string;
  members: { person: string; role: "founder" | "cofounder" | "employee" | "advisor" | "contractor"; title: string; isAdmin?: boolean }[];
  needs: { type: "cofounder" | "consultant" | "advisor" | "employee" | "freelancer"; title: string; description: string; category?: string; skills?: string[] }[];
  openRoles?: { title: string; type: string; description: string }[];
};

export const DEMO_STARTUPS: DemoStartup[] = [
  {
    key: "kinwell", name: "Kinwell", tagline: "Care coordination for families, not just providers.",
    description: "Kinwell gives families one shared place to coordinate appointments, medications and caregivers for an aging parent.",
    problem: "Families caring for an aging parent juggle calls, texts and portals across five or more providers — and things fall through the cracks.",
    solution: "A shared family care hub that pulls schedules together, assigns tasks, and uses AI to summarize visit notes in plain language.",
    stage: "validation", businessModel: "b2c", location: "New York", workMode: "hybrid", industries: ["Health", "AI", "Consumer"], fundingStatus: "bootstrapped",
    traction: "40 family interviews, 120-person waitlist, 2 home-care agencies interested in piloting.",
    members: [{ person: "lisa", role: "founder", title: "CEO", isAdmin: true }],
    needs: [
      { type: "cofounder", title: "Technical cofounder", description: "Someone to own product and engineering, ideally with ML or healthcare experience.", skills: ["full-stack", "machine-learning"] },
      { type: "consultant", title: "Growth consultant", description: "Help us design a waitlist-to-activation growth plan.", category: "growth" },
      { type: "advisor", title: "Healthcare compliance advisor", description: "Guidance on HIPAA and data handling as we pilot with agencies." },
    ],
    openRoles: [{ title: "Founding engineer", type: "employee", description: "First engineering hire; full-stack with an interest in AI." }],
  },
  {
    key: "ledgerly", name: "Ledgerly", tagline: "Close the books in hours, not weeks.",
    description: "AI copilot for finance teams at growing companies that automates reconciliation and month-end close.",
    problem: "Finance teams at 50–500 person companies spend two weeks every month on manual reconciliation.",
    solution: "An AI agent that matches transactions, flags anomalies and drafts close checklists, integrated with existing accounting tools.",
    stage: "idea", businessModel: "b2b_saas", location: "Chicago", workMode: "hybrid", industries: ["Fintech", "AI", "B2B SaaS"], fundingStatus: "not_raising",
    members: [{ person: "daniel", role: "founder", title: "CEO", isAdmin: true }],
    needs: [{ type: "cofounder", title: "Technical cofounder (AI)", description: "An engineer excited about applied LLMs in finance.", skills: ["llm-apps", "backend"] }],
  },
  {
    key: "gridwise", name: "Gridwise", tagline: "Smarter charging schedules for EV fleets.",
    description: "Software that shifts fleet charging to cheaper, cleaner hours automatically.",
    problem: "Fleet operators pay peak electricity prices because charging schedules ignore grid conditions.",
    solution: "A scheduling engine that plans charging around real-time prices and carbon intensity.",
    stage: "prototype", businessModel: "b2b_saas", location: "Toronto", workMode: "remote", industries: ["Climate", "Mobility"], fundingStatus: "bootstrapped",
    traction: "Prototype running on one 12-vehicle fleet; 18% reduction in charging costs over 6 weeks.",
    members: [{ person: "amara", role: "founder", title: "Founder & CTO", isAdmin: true }],
    needs: [
      { type: "cofounder", title: "Commercial cofounder", description: "Someone with fleet or energy sales experience.", skills: ["b2b-sales", "climate-domain"] },
      { type: "consultant", title: "Fundraising help", description: "Prepare for a pre-seed raise in the next 6 months.", category: "fundraising" },
    ],
  },
];
