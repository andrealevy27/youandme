export const WAITLIST_INTENTS = [
  { value: "building", label: "I'm building a startup" },
  { value: "cofounder", label: "I'm looking for a cofounder" },
  { value: "join", label: "I want to join an early team" },
  { value: "consult", label: "I want to offer consulting" },
  { value: "advise", label: "I want to advise founders" },
  { value: "exploring", label: "Just exploring" },
] as const;

export const WAITLIST_SOURCES = [
  { value: "friend", label: "A friend or colleague" },
  { value: "school", label: "My school or university" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "search", label: "Google or another search engine" },
  { value: "event", label: "An event or meetup" },
  { value: "press", label: "Newsletter, podcast or article" },
  { value: "other", label: "Other" },
] as const;
