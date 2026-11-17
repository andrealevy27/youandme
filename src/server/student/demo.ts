import "server-only";
import { scoreCompatibility } from "../matching/engine";
import type { MatchProfile } from "../matching/types";
import { DEFAULT_MATCH_WEIGHTS } from "../settings";
import { oneLineReason, studentReasons, talkAboutEarly, type StudentFacts } from "./reasons";
import { schoolBySlug } from "@/lib/schools";
import { CLASS_YEARS, weeklyHoursLabel } from "@/lib/student";
import type { CofounderType, SkillCategory } from "@/lib/domain";

/**
 * Demo mode: sample students that exist only in this file — never in the database, never mixed
 * with real people, always labelled. The matching engine and reason generator are the real ones.
 */
type Sample = {
  id: string;
  name: string;
  school: "nyu" | "stanford";
  year: (typeof CLASS_YEARS)[number]["key"];
  major: string;
  skills: [string, SkillCategory][];
  industries: string[];
  ideaStatus: "have_idea" | "join_one" | "open";
  ideaSummary?: string;
  weeklyHours: number;
  summerPlans: "build" | "internship" | "undecided" | "graduating";
  seeking: CofounderType[];
  /** vision_operator, pace, structure, autonomy, risk, communication, focus — each −100…100 */
  style: [number, number, number, number, number, number, number];
};

const SAMPLES: Sample[] = [
  { id: "s1", name: "Maya Rodriguez", school: "nyu", year: "junior", major: "Mechanical Engineering", skills: [["Hardware engineering", "engineering"], ["Product design", "design"]], industries: ["Climate", "Robotics"], ideaStatus: "join_one", weeklyHours: 15, summerPlans: "build", seeking: ["business"], style: [20, -40, -20, 10, -30, -50, 40] },
  { id: "s2", name: "Dev Kapoor", school: "nyu", year: "sophomore", major: "Computer Science", skills: [["Full-stack development", "engineering"], ["Machine learning", "ai_ml"]], industries: ["Education", "AI"], ideaStatus: "join_one", weeklyHours: 8, summerPlans: "build", seeking: ["business", "design"], style: [40, -60, 20, -20, -40, -20, 30] },
  { id: "s3", name: "Ana Lopez", school: "nyu", year: "mba", major: "MBA", skills: [["B2B sales", "sales"], ["Go-to-market", "business"]], industries: ["Education", "Fintech"], ideaStatus: "join_one", weeklyHours: 15, summerPlans: "build", seeking: ["technical"], style: [30, -20, -40, 20, -10, -60, -20] },
  { id: "s4", name: "Sam Okafor", school: "stanford", year: "senior", major: "Economics", skills: [["Growth marketing", "growth"], ["Community building", "growth"]], industries: ["Education"], ideaStatus: "have_idea", ideaSummary: "Peer tutoring marketplace for intro CS courses", weeklyHours: 8, summerPlans: "internship", seeking: ["technical"], style: [-50, -40, 30, 20, -50, -30, -40] },
  { id: "s5", name: "Priya Nair", school: "nyu", year: "masters", major: "Data Science", skills: [["Data science", "ai_ml"], ["LLM applications", "ai_ml"]], industries: ["Health", "AI"], ideaStatus: "open", weeklyHours: 15, summerPlans: "undecided", seeking: ["business"], style: [10, 20, -50, -30, 30, 20, 60] },
  { id: "s6", name: "Leo Weiss", school: "nyu", year: "freshman", major: "Design", skills: [["UI design", "design"], ["Brand design", "design"]], industries: ["Consumer", "Creator economy"], ideaStatus: "join_one", weeklyHours: 3, summerPlans: "internship", seeking: ["technical"], style: [-30, -50, 40, 30, -40, 10, 20] },
  { id: "s7", name: "Hana Kim", school: "stanford", year: "phd", major: "Bioengineering", skills: [["Healthcare domain", "domain"], ["Data science", "ai_ml"]], industries: ["Health", "Biotech"], ideaStatus: "have_idea", ideaSummary: "Low-cost diagnostics for rural clinics", weeklyHours: 15, summerPlans: "build", seeking: ["business"], style: [-40, 30, -40, -10, 20, 40, 50] },
  { id: "s8", name: "Omar Haddad", school: "nyu", year: "junior", major: "Finance", skills: [["Financial modeling", "finance"], ["Fundraising", "finance"]], industries: ["Fintech"], ideaStatus: "join_one", weeklyHours: 8, summerPlans: "build", seeking: ["technical"], style: [40, -20, -30, 40, -20, -40, -10] },
  { id: "s9", name: "Grace Liu", school: "stanford", year: "sophomore", major: "Computer Science", skills: [["Mobile development", "engineering"], ["Backend engineering", "engineering"]], industries: ["Education", "Consumer"], ideaStatus: "join_one", weeklyHours: 15, summerPlans: "build", seeking: ["business", "growth"], style: [30, -50, 10, -40, -50, -40, 30] },
  { id: "s10", name: "Jamal Brooks", school: "nyu", year: "senior", major: "Business & Political Economy", skills: [["Partnerships", "sales"], ["Operations", "operations"]], industries: ["Social impact", "Education"], ideaStatus: "join_one", weeklyHours: 15, summerPlans: "graduating", seeking: ["technical", "product"], style: [20, -10, -50, 30, -10, -30, -30] },
  { id: "s11", name: "Sofia Rossi", school: "stanford", year: "masters", major: "Product Design", skills: [["Product management", "product"], ["UX research", "design"]], industries: ["Climate", "Mobility"], ideaStatus: "open", weeklyHours: 8, summerPlans: "undecided", seeking: ["technical"], style: [-20, 10, -30, 20, 0, 10, 40] },
  { id: "s12", name: "Ethan Park", school: "nyu", year: "junior", major: "Computer Engineering", skills: [["Cloud infrastructure", "engineering"], ["Security engineering", "engineering"]], industries: ["Developer tools", "Security"], ideaStatus: "join_one", weeklyHours: 25, summerPlans: "build", seeking: ["business"], style: [50, -30, 30, -50, -30, -50, 50] },
];

const PERSONAS: Record<"idea" | "join", Sample> = {
  idea: { id: "you-idea", name: "You", school: "nyu", year: "junior", major: "Computer Science", skills: [["Full-stack development", "engineering"], ["Product strategy", "product"]], industries: ["Education", "AI"], ideaStatus: "have_idea", ideaSummary: "Study-group matching for big lecture classes", weeklyHours: 15, summerPlans: "build", seeking: ["business", "design"], style: [-40, -40, 10, 10, -30, -40, -30] },
  join: { id: "you-join", name: "You", school: "stanford", year: "sophomore", major: "Economics", skills: [["Growth marketing", "growth"], ["B2B sales", "sales"]], industries: ["Education", "Fintech"], ideaStatus: "join_one", weeklyHours: 8, summerPlans: "build", seeking: ["technical"], style: [30, -30, -20, 20, -20, -30, -20] },
};

const DIMS = ["vision_operator", "pace", "structure", "autonomy", "risk", "communication", "focus"] as const;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function toMatchProfile(s: Sample): MatchProfile {
  return {
    userId: s.id,
    name: s.name,
    roles: [],
    skills: s.skills.map(([name, category]) => ({ slug: slug(name), name, category, level: 2 })),
    industries: s.industries.map((name) => ({ slug: slug(name), name })),
    cofounderTypesSought: s.seeking,
    stagePreferences: [],
    commitment: s.summerPlans === "build" || s.summerPlans === "graduating" ? "full_time_soon" : s.weeklyHours < 5 ? "exploring" : "part_time",
    availability: s.weeklyHours >= 10 ? "part_time" : s.weeklyHours >= 5 ? "nights_weekends" : "limited",
    workMode: null,
    ambition: null,
    founderExperience: null,
    city: null,
    country: null,
    timezone: "America/New_York",
    personality: Object.fromEntries(DIMS.map((d, i) => [d, s.style[i]])),
    hasStartup: false,
  };
}

const toFacts = (s: Sample): StudentFacts => ({
  name: s.name,
  school: s.school,
  ideaStatus: s.ideaStatus,
  ideaSummary: s.ideaSummary ?? null,
  weeklyHours: s.weeklyHours,
  summerPlans: s.summerPlans,
});

export type DemoPerson = {
  id: string;
  name: string;
  school: string;
  schoolSlug: string;
  headline: string;
  skills: string[];
  interests: string[];
  hours: string;
  ideaLine: string | null;
  oneLiner: string;
  reasons: string[];
  talkAboutEarly: string[];
  score: number;
};

export type DemoPersona = { key: "idea" | "join"; label: string; summary: string; schoolSlug: string; schoolShort: string; people: DemoPerson[] };

function describe(s: Sample) {
  const year = CLASS_YEARS.find((y) => y.key === s.year)!.label;
  return s.major.toLowerCase() === year.toLowerCase() ? year : `${s.major} · ${year}`;
}

/** Everything the /demo page shows, computed with the real engine. */
export function buildDemo(): DemoPersona[] {
  return (Object.keys(PERSONAS) as ("idea" | "join")[]).map((key) => {
    const me = PERSONAS[key];
    const meProfile = toMatchProfile(me);
    const people = SAMPLES.map((s) => {
      const result = scoreCompatibility(meProfile, toMatchProfile(s), DEFAULT_MATCH_WEIGHTS);
      const school = schoolBySlug(s.school)!;
      return {
        id: s.id,
        name: s.name,
        school: school.shortName,
        schoolSlug: s.school,
        headline: describe(s),
        skills: s.skills.map(([n]) => n),
        interests: s.industries,
        hours: weeklyHoursLabel(s.weeklyHours) ?? "",
        ideaLine: s.ideaStatus === "have_idea" ? `Has an idea: ${s.ideaSummary}` : s.ideaStatus === "join_one" ? "Wants to join an idea" : "Open to pitching or joining",
        oneLiner: oneLineReason(toFacts(me), toFacts(s), result),
        reasons: studentReasons(toFacts(me), toFacts(s), result),
        talkAboutEarly: talkAboutEarly(result),
        score: result.score,
      };
    }).sort((a, b) => b.score - a.score);
    return {
      key,
      label: key === "idea" ? "I have an idea" : "I want to join one",
      summary:
        key === "idea"
          ? `NYU junior in CS with an idea (“${me.ideaSummary}”), looking for business and design help, ~10–20 hrs/week.`
          : "Stanford sophomore in Economics who does growth and sales, wants to join a technical founder, ~5–10 hrs/week.",
      schoolSlug: me.school,
      schoolShort: schoolBySlug(me.school)!.shortName,
      people,
    };
  });
}
