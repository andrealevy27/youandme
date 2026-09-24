export const DISCOVER_TABS = [
  { key: "people", label: "People" },
  { key: "founders", label: "Founders" },
  { key: "cofounders", label: "Cofounders" },
  { key: "consultants", label: "Consultants" },
  { key: "startups", label: "Startups" },
  { key: "talent", label: "Talent" },
] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number]["key"];

export const DISCOVER_EXAMPLE = "AI engineer at NYU interested in health startups";

/** URL params the Discover page understands. Everything is a plain string in the URL. */
export const PEOPLE_PARAMS = ["cat", "industry", "commitment", "availability", "location", "stage"] as const;
export const STARTUP_PARAMS = ["stage", "industry", "lookingFor"] as const;

export function isDiscoverTab(v: string | undefined): v is DiscoverTab {
  return DISCOVER_TABS.some((t) => t.key === v);
}
