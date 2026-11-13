import { statusLabel, type Locale } from "@/lib/i18n";
import { PlatformMark } from "@/components/visual";

const TONE: Record<string, string> = {
  pending_approval: "bg-[#E7F6F3] text-[#167e6c] border-[#B7DDD4]",
  queued: "bg-[#E7F6F3] text-[#167e6c] border-[#B7DDD4]",
  changes_requested: "bg-[#FDF6E7] text-[#B45309] border-[#EED6A3]",
  planned: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  plan_approved: "bg-[#E6F2ED] text-[#0B624C] border-[#C5E0D4]",
  approved: "bg-[#E6F2ED] text-[#0B624C] border-[#C5E0D4]",
  unscheduled: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  schedule_approved: "bg-[#E6F2ED] text-[#0B624C] border-[#C5E0D4]",
  script_ready: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  repurposed: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  brief_ready: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  published: "bg-[#E6F2ED] text-[#0B624C] border-[#C5E0D4]",
  rejected: "bg-[#FEECEC] text-[#B42318] border-[#F5C2C0]",
  draft: "bg-[#E7F1EC] text-[#1C453A] border-[#D5E3DD]",
  sent: "bg-[#E6F2ED] text-[#0B624C] border-[#C5E0D4]",
};

export function StatusBadge({ locale, status, label }: { locale: Locale; status: string; label?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-[4px] border px-1.5 text-[13px] font-bold leading-none ${TONE[status] ?? TONE.planned}`}>
      <span className={`size-1.5 rounded-full ${status === "rejected" ? "bg-[#B42318]" : status === "approved" || status === "published" || status === "plan_approved" ? "bg-[#0B624C]" : status === "changes_requested" ? "bg-[#B45309]" : "bg-[#167e6c]"}`} />
      {label ?? statusLabel(locale, status)}
    </span>
  );
}

export function PlatformChips({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((platform) => (
        <span key={platform} className="inline-flex size-6 items-center justify-center rounded-[4px] border border-[#D5E3DD] bg-[#F2F6F4]">
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
    <span className={`inline-flex h-5 items-center rounded-[4px] border px-1.5 text-[13px] font-medium ${warning ? "border-[#EED6A3] bg-[#FDF6E7] text-[#B45309]" : "border-[#D5E3DD] bg-[#E7F1EC] text-[#1C453A]"}`}>
      {label}
    </span>
  );
}
