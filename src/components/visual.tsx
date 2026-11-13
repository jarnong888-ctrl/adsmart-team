"use client";

import { Info } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info className="size-3.5 text-[#3D5C54]" aria-hidden />
      <span className="sr-only">{text}</span>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-44 -translate-x-1/2 rounded-[6px] bg-[#0B624C] px-2 py-1 text-left text-[13px] leading-snug font-normal tracking-normal text-white group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className="size-12" role="img" aria-label={label}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="#D5E3DD" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="#0B624C" strokeWidth="4" strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 24 24)" />
      <text x="24" y="27" textAnchor="middle" className="fill-[#10251F] text-[13px] font-semibold">{Math.round(pct)}</text>
    </svg>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const d = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 72;
    const y = 22 - ((value - min) / span) * 18;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 72 24" className="mt-2 h-6 w-[72px]" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="#0B624C" strokeWidth="1.75" />
    </svg>
  );
}

export function PlatformMark({ platform, labeled = false }: { platform: string; labeled?: boolean }) {
  const key = platform.toLowerCase();
  return (
    <span className="inline-flex items-center gap-1" title={platform}>
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        {key === "tiktok" ? <path fill="#10251F" d="M10 2c.4 2.2 1.6 3.4 3.5 3.6v2.1c-1.2 0-2.3-.4-3.3-1.1v4.6A4.2 4.2 0 1 1 6 7.1v2.2a2.1 2.1 0 1 0 1.5 2V2H10Z" /> : null}
        {key === "instagram" ? <><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="#10251F" strokeWidth="1.4" /><circle cx="8" cy="8" r="2.6" fill="none" stroke="#10251F" strokeWidth="1.4" /><circle cx="11.4" cy="4.6" r="0.7" fill="#10251F" /></> : null}
        {key === "facebook" ? <path fill="#10251F" d="M9 14V8.7h1.6l.3-1.8H9V5.7c0-.5.2-.9.9-.9H11V3.1C10.8 3 10.1 3 9.4 3 7.8 3 6.7 4 6.7 5.6v1.3H5.2v1.8h1.5V14H9Z" /> : null}
        {key === "youtube" ? <><rect x="1.5" y="3.5" width="13" height="9" rx="2" fill="#10251F" /><path fill="#fff" d="M7 6.2v3.6L10.2 8 7 6.2Z" /></> : null}
        {key !== "tiktok" && key !== "instagram" && key !== "facebook" && key !== "youtube" ? <circle cx="8" cy="8" r="5" fill="none" stroke="#10251F" strokeWidth="1.4" /> : null}
      </svg>
      {labeled ? <span className="text-[13px]">{platform}</span> : <span className="sr-only">{platform}</span>}
    </span>
  );
}
