import { statusLabel, type Locale } from "@/lib/i18n";
import { PlatformMark } from "@/components/visual";

// One tone per stage. Tones differ in lightness as well as hue, so they stay
// distinguishable for colour-blind readers and in greyscale print.
type Tone = { pill: string; dot: string };
const T = {
  neutral: { pill: "bg-[#EEF0EF] text-[#3F4A45]", dot: "bg-[#8A968F]" },
  slate: { pill: "bg-[#EAEFF4] text-[#334556]", dot: "bg-[#6B8299]" },
  amber: { pill: "bg-[#FDF3E1] text-[#7A4F00]", dot: "bg-[#D9930D]" },
  orange: { pill: "bg-[#FCEBDD] text-[#8F3A0A]", dot: "bg-[#E0731F]" },
  blue: { pill: "bg-[#E8F0FB] text-[#1A4F9E]", dot: "bg-[#3B7DDD]" },
  violet: { pill: "bg-[#F1EDFB] text-[#4F3596]", dot: "bg-[#7C5CD6]" },
  green: { pill: "bg-[#E5F4EC] text-[#0B5A42]", dot: "bg-[#1E9A6E]" },
  ink: { pill: "bg-[#1B2A24] text-white", dot: "bg-[#6EE7B7]" },
  red: { pill: "bg-[#FEECEC] text-[#9F1F15]", dot: "bg-[#D93A2B]" },
} satisfies Record<string, Tone>;

export const STATUS_TONE: Record<string, Tone> = {
  planned: T.neutral,
  plan_approved: T.slate,
  script_ready: T.amber,
  repurposed: T.blue,
  brief_ready: T.violet,
  queued: T.orange,
  schedule_approved: T.green,
  published: T.ink,
  pending_approval: T.amber,
  changes_requested: T.orange,
  approved: T.green,
  unscheduled: T.neutral,
  rejected: T.red,
  draft: T.neutral,
  sent: T.green,
  dismissed: T.neutral,
};

export function StatusBadge({ locale, status, label }: { locale: Locale; status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? T.neutral;
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium leading-none whitespace-nowrap ${tone.pill}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      {label ?? statusLabel(locale, status)}
    </span>
  );
}

export function PlatformChips({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((platform) => (
        <span key={platform} className="inline-flex size-6 items-center justify-center rounded-[4px] border border-[#E4E8E5] bg-[#F6F7F5]">
          <PlatformMark platform={platform} />
        </span>
      ))}
    </div>
  );
}

export function FlagChip({ locale, flag }: { locale: Locale; flag: string }) {
  const warning = flag === "NEEDS_FACT_CHECK";
  const label = flag === "NEEDS_FACT_CHECK"
    ? locale === "zh" ? "待核实" : "Needs fact-check"
    : flag === "COMMERCIAL_DISCLOSURE"
      ? locale === "zh" ? "商业披露" : "Disclosure"
      : flag === "DEMO"
        ? locale === "zh" ? "实拍" : "Demo"
        : flag;
  return (
    <span className={`inline-flex h-5 items-center rounded-[4px] border px-1.5 text-[13px] font-medium ${warning ? "border-[#EED6A3] bg-[#FDF6E7] text-[#B45309]" : "border-[#E4E8E5] bg-[#EEF1EF] text-[#3F4C46]"}`}>
      {label}
    </span>
  );
}
