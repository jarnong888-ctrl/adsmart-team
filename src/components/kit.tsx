import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Shared building blocks for the studio pages. Server-safe (no client hooks),
 * so pages stay server components. Colours follow the tokens in globals.css.
 */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`overflow-hidden rounded-[16px] border border-[#E4E8E5] bg-white ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF1EF] px-5 py-4">
          <div className="min-w-0">
            <h2 className="type-h2">{title}</h2>
            {subtitle ? <p className="type-caption mt-0.5">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "warn" | "good";
  children?: React.ReactNode;
}) {
  const valueColor = tone === "warn" ? "text-[#9A5B00]" : tone === "good" ? "text-[#0B5A42]" : "text-[#14201B]";
  return (
    <article className="flex min-w-0 flex-col rounded-[16px] border border-[#E4E8E5] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#5E6B65]">{label}</p>
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-[10px] bg-[#F1F5F2] text-[#0F6B4F]">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className={`nums mt-2 text-[30px] leading-none tracking-[-0.02em] ${valueColor}`}>{value}</p>
      {sub ? <p className="mt-2 text-[13px] leading-snug text-[#5E6B65]">{sub}</p> : null}
      {children}
    </article>
  );
}

const BUTTON = {
  primary: "bg-[#0F6B4F] text-white hover:bg-[#0A5540] border border-[#0F6B4F]",
  outline: "border border-[#DCE1DE] bg-white text-[#14201B] hover:bg-[#F1F3F2]",
  ghost: "text-[#0F6B4F] hover:bg-[#E9F4EE]",
  dark: "bg-[#14201B] text-white hover:bg-[#26342E] border border-[#14201B]",
};

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  scroll,
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof BUTTON;
  size?: "sm" | "md";
  className?: string;
  scroll?: boolean;
}) {
  const sizing = size === "sm" ? "h-9 px-3 text-[13.5px]" : "h-10 px-4 text-[14px]";
  return (
    <Link href={href} scroll={scroll} className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap transition-colors ${sizing} ${BUTTON[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function EmptyPanel({
  icon: Icon,
  title,
  body,
  children,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-5 py-8" : "px-6 py-14"}`}>
      {Icon ? (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-[#F1F5F2] text-[#0F6B4F]">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="text-[15px] font-semibold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-[#5E6B65]">{body}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "good" | "info" }) {
  const tones = {
    neutral: "bg-[#EEF1EF] text-[#3F4C46]",
    warn: "bg-[#FDF3E1] text-[#7A4F00]",
    good: "bg-[#E5F4EC] text-[#0B5A42]",
    info: "bg-[#E8F0FB] text-[#1A4F9E]",
  };
  return <span className={`inline-flex h-6 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

/** A horizontal bar split by share, with a legend. */
export function MixBar({ parts, label }: { parts: { label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${parts.map((part) => `${part.label} ${part.value}%`).join(", ")}`}>
        {parts.filter((part) => part.value > 0).map((part) => (
          <span key={part.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(part.value / total) * 100}%`, backgroundColor: part.color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#5E6B65]">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: part.color }} aria-hidden />
            {part.label} <span className="nums text-[#14201B]">{part.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const PILLAR_COLOR: Record<string, string> = {
  mindset: "#14201B",
  practical: "#1E9A6E",
  trends: "#7C5CD6",
};

/** Progress bar 0–100. */
export function Meter({ value, label, tone = "good" }: { value: number; label: string; tone?: "good" | "warn" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#EEF1EF]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className={`h-full rounded-full ${tone === "warn" ? "bg-[#D9930D]" : "bg-[#1E9A6E]"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
