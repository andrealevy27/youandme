/**
 * Schools FoundMate accepts in student mode.
 *
 * To add a school, add one entry. `domains` are the email domains its students
 * sign up with; subdomains (e.g. cs.stanford.edu) are accepted automatically.
 */
export type School = { slug: string; name: string; shortName: string; domains: string[] };

export const SCHOOLS: School[] = [
  { slug: "nyu", name: "New York University", shortName: "NYU", domains: ["nyu.edu"] },
  { slug: "stanford", name: "Stanford University", shortName: "Stanford", domains: ["stanford.edu"] },
];

export function emailDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

/** The school an email address belongs to, or null if it isn't an accepted school email. */
export function schoolForEmail(email: string): School | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  return SCHOOLS.find((s) => s.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) ?? null;
}

export function schoolBySlug(slug: string | null | undefined): School | null {
  if (!slug) return null;
  return SCHOOLS.find((s) => s.slug === slug) ?? null;
}

export const SCHOOL_LIST_TEXT = SCHOOLS.map((s) => `@${s.domains[0]}`).join(" or ");
