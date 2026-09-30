/**
 * Pure helpers shared by admin pages, actions and services.
 * No database or framework imports so they are trivially unit-testable.
 */
import { FACTOR_KEYS, type FactorKey, type MatchWeights } from "../matching/types";
import { normaliseWeights as normaliseKeyed } from "../../components/admin/normalise";

export const ADMIN_PAGE_SIZE = 25;

type SearchParamValue = string | string[] | undefined;
export type AdminSearchParams = Record<string, SearchParamValue>;

/** First value of a search param, trimmed; empty strings become undefined. */
export function param(sp: AdminSearchParams, key: string): string | undefined {
  const raw = sp[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim();
  return t ? t : undefined;
}

/** 1-based page number from search params; invalid or negative values fall back to 1. */
export function parsePage(value: SearchParamValue, max = 10_000): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

export function pageOffset(page: number, pageSize = ADMIN_PAGE_SIZE) {
  return (Math.max(1, page) - 1) * pageSize;
}

export function pageCount(total: number, pageSize = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Pick an allowed value from a search param, else the fallback. */
export function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Escape LIKE wildcards so user search text is matched literally. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Weights → rounded percentages that always sum to 100 (or all zeros when every weight is 0). */
export function normaliseWeights(weights: Partial<Record<FactorKey, number>>): Record<FactorKey, number> {
  return normaliseKeyed(FACTOR_KEYS, weights);
}

export function isValidWeights(w: MatchWeights) {
  return FACTOR_KEYS.every((k) => Number.isInteger(w[k]) && w[k] >= 0 && w[k] <= 100) && FACTOR_KEYS.some((k) => w[k] > 0);
}

export const FACTOR_LABELS: Record<FactorKey, string> = {
  skills: "Skill complementarity",
  goals: "Goal alignment",
  commitment: "Commitment",
  industry: "Industry",
  personality: "Personality",
  workingStyle: "Working style",
  location: "Location / remote",
  availability: "Availability",
};

/** "tiktok, Paid Social ,, seo" → ["tiktok", "paid social", "seo"] (deduped, lowercased). */
export function parseKeywords(input: string | undefined | null): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  for (const part of input.split(",")) {
    const k = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (k && k.length <= 60) seen.add(k);
  }
  return [...seen].slice(0, 50);
}

export function bpsToPercentLabel(bps: number) {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}

/** Suspension end date; `null` days means "until lifted". */
export function suspensionEnd(days: number | null, now = new Date()): Date | null {
  if (days === null) return null;
  return new Date(now.getTime() + days * 86_400_000);
}

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly invite code without ambiguous characters (no 0/O, 1/I). */
export function generateInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

export function inviteState(invite: { uses: number; maxUses: number; expiresAt: Date | null }, now = new Date()) {
  if (invite.expiresAt && invite.expiresAt <= now) return "expired" as const;
  if (invite.uses >= invite.maxUses) return "used" as const;
  return "active" as const;
}

/** Percentage with one decimal, or null when the denominator is zero (render as "—"). */
export function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Split an array into chunks (used for batched inserts). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * RFC 4180 CSV. Cells starting with a formula character are prefixed with `'`
 * so spreadsheets don't execute user-supplied text (CSV injection).
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Only link to real LinkedIn URLs from admin screens. */
export function safeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname === "linkedin.com" || u.hostname.endsWith(".linkedin.com") ? u.toString() : null;
  } catch {
    return null;
  }
}
