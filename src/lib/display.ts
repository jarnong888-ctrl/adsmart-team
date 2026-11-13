import type { Locale } from "@/lib/i18n";

export const PLATFORM_NAME: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };
export const LANG_NAME: Record<string, string> = { zh: "中文", en: "EN", ms: "BM" };

/** Weekday, day number and a short long-form label for an ISO date (YYYY-MM-DD). */
export function dayParts(iso: string, locale: Locale) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const loc = locale === "zh" ? "zh-CN" : "en-GB";
  return {
    dow: new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(date),
    day: d,
    long: new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date),
  };
}

/** "9 Nov – 15 Nov 2026" / "2026年11月9日 这一周" for a Monday ISO date. */
export function weekLabel(weekStart: string, locale: Locale) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (locale === "zh") return `${y}年${m}月${d}日 这一周`;
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const fmt = (date: Date, withYear: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(date);
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}
