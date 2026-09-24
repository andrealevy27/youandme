/** Shared (server + client) list of marketplace filter params. */
export const FILTER_KEYS = ["q", "category", "industry", "maxPrice", "minRating", "stage", "language", "remote", "week"] as const;

export function activeFilterCount(params: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]);
  return FILTER_KEYS.filter((k) => !!get(k)).length;
}
