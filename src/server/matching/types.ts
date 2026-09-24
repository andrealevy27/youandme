import type {
  Ambition,
  Availability,
  CofounderType,
  Commitment,
  FounderExperience,
  SkillCategory,
  StartupStage,
  WorkMode,
} from "@/lib/domain";
import type { DimensionKey } from "@/lib/personality";

/** Everything the matching engine knows about a person. Built from DB rows by `loadMatchProfiles`. */
export type MatchProfile = {
  userId: string;
  name: string;
  roles: string[];
  skills: { slug: string; name: string; category: SkillCategory; level: number }[];
  industries: { slug: string; name: string }[];
  cofounderTypesSought: CofounderType[];
  stagePreferences: StartupStage[];
  commitment: Commitment | null;
  availability: Availability | null;
  workMode: WorkMode | null;
  ambition: Ambition | null;
  founderExperience: FounderExperience | null;
  city: string | null;
  country: string | null;
  timezone: string;
  personality: Partial<Record<DimensionKey, number>> | null;
  hasStartup: boolean;
};

export const FACTOR_KEYS = [
  "skills",
  "goals",
  "commitment",
  "industry",
  "personality",
  "workingStyle",
  "location",
  "availability",
] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export type MatchWeights = Record<FactorKey, number>;

export type CompatibilityFactor = {
  key: FactorKey;
  label: string;
  /** 0..1 */
  score: number;
  weight: number;
  /** false when data was missing and a neutral score was used */
  known: boolean;
  detail: string;
};

export type FrictionPoint = { key: FactorKey | "personality_dimension"; title: string; detail: string };

export type CompatibilityResult = {
  /** 0..100 */
  score: number;
  factors: CompatibilityFactor[];
  strengths: CompatibilityFactor[];
  frictions: FrictionPoint[];
  sharedInterests: string[];
  complementarySkills: string[];
  explanation: string;
  algorithmVersion: string;
};

/** Pluggable scorer so an ML model can replace the rule-based engine later. */
export interface CompatibilityScorer {
  readonly version: string;
  score(viewer: MatchProfile, candidate: MatchProfile, weights: MatchWeights): CompatibilityResult;
}
