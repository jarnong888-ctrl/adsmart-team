"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

const LABELS: Record<string, [string, string]> = {
  "/studio": ["Today", "今天"],
  "/studio/pipeline": ["Pipeline", "流水线"],
  "/studio/strategist": ["Strategy", "策略"],
  "/studio/scripts": ["Scripts", "脚本"],
  "/studio/repurpose": ["Repurpose", "改写"],
  "/studio/editor": ["Editor", "剪辑"],
  "/studio/schedule": ["Schedule", "排期"],
  "/studio/analytics": ["Analytics", "数据"],
  "/studio/connections": ["Connections", "连接"],
  "/studio/credits": ["Credits", "充值"],
  "/studio/competitors": ["Insights", "观察"],
  "/studio/workspace": ["Workspace", "工作区"],
  "/studio/privacy": ["Privacy", "隐私"],
  "/studio/approve": ["Approval", "审批"],
};

export function ShellTop({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const key = Object.keys(LABELS).find((item) => pathname === item || (item !== "/studio" && pathname.startsWith(`${item}/`))) ?? "/studio";
  const pair = LABELS[key];
  return <p className="truncate text-[13px] text-[#1C453A]">{locale === "zh" ? pair[1] : pair[0]}</p>;
}
