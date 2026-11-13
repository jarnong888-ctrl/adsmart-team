import Link from "next/link";
import { ArrowUpRight, Check, Repeat2 } from "lucide-react";
import { EmptyPanel, Panel, StatTile, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { pillarLabel, tr, type Locale } from "@/lib/i18n";
import { repurposeItem } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

export default async function RepurposePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "repurposer", user.id);
  const items = await prisma.contentItem.findMany({
    where: { workspaceId: workspace.id, status: { in: ["script_ready", "repurposed", "brief_ready", "queued", "schedule_approved", "published"] } },
    include: { repurpose: true },
    orderBy: { updatedAt: "desc" },
  });
  const ready = items.filter((item) => item.status === "script_ready");
  const done = items.filter((item) => item.status !== "script_ready");
  const formats = [
    tr(locale, "Instagram caption", "Instagram 文案"),
    tr(locale, "Carousel outline", "轮播提纲"),
    tr(locale, "Facebook post", "Facebook 帖子"),
    tr(locale, "Size notes", "尺寸说明"),
  ];

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Repurpose", "改写")}
        lede={tr(locale, "Turn one script into an Instagram caption, a carousel, a Facebook post and size notes for 9:16, 1:1, 4:5 and 16:9.", "把一条脚本改写成 Instagram 文案、轮播、Facebook 帖子，以及 9:16、1:1、4:5、16:9 的尺寸说明。")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={tr(locale, "Ready to repurpose", "待改写")} value={ready.length} icon={Repeat2} tone={ready.length ? "warn" : "default"} sub={tr(locale, "Scripts waiting for formats", "等改写的脚本")} />
        <StatTile label={tr(locale, "Repurposed", "已改写")} value={done.length} icon={Check} sub={tr(locale, "Have all four formats", "四种格式齐全")} />
        <StatTile label={tr(locale, "Formats per script", "每条脚本的格式")} value={4} sub={formats.join(" · ")} />
      </div>

      <Panel title={tr(locale, "Ready to repurpose", "待改写")} subtitle={tr(locale, "Scripts that are written and waiting for their other formats.", "已写好、等着改写成其他格式的脚本。")} action={ready.length ? <Tag tone="warn">{ready.length}</Tag> : null}>
        {ready.length === 0 ? (
          <EmptyPanel compact icon={Check} title={tr(locale, "Nothing waiting", "没有待改写的脚本")} body={tr(locale, "Scripts appear here once they’re written.", "脚本写好后会出现在这里。")} />
        ) : (
          <ul className="divide-y divide-[#EEF1EF]">
            {ready.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <Link href={`/studio/pipeline/${item.id}`} className="font-cjk block text-[15px] font-medium leading-snug hover:text-[#0F6B4F]">{item.title}</Link>
                  <p className="mt-1 text-[12.5px] text-[#5E6B65]">{pillarLabel(locale, item.pillar)} · {item.language.toUpperCase()}</p>
                </div>
                <form action={repurposeItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="returnTo" value="/studio/repurpose" />
                  <SubmitButton size="sm">
                    <Repeat2 className="size-4" aria-hidden />
                    {tr(locale, "Repurpose", "改写")}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section aria-labelledby="done-heading">
        <h2 id="done-heading" className="type-h2 mb-3">{tr(locale, "Repurposed", "已改写")}</h2>
        {done.length === 0 ? (
          <Panel><EmptyPanel compact title={tr(locale, "Nothing repurposed yet", "还没有改写过")} /></Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {done.map((item) => (
              <FormatCard key={item.id} locale={locale} formats={formats} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FormatCard({
  locale,
  formats,
  item,
}: {
  locale: Locale;
  formats: string[];
  item: { id: string; title: string; status: string; repurpose: { igCaption: string } | null };
}) {
  const preview = item.repurpose?.igCaption.split("\n").filter(Boolean).slice(0, 3).join(" ");
  return (
    <Link href={`/studio/pipeline/${item.id}`} className="group flex flex-col rounded-[16px] border border-[#E4E8E5] bg-white p-5 transition hover:border-[#C9D0CC] hover:shadow-[0_6px_16px_-8px_rgba(20,32,27,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-cjk text-[15px] leading-snug font-medium">{item.title}</p>
        <ArrowUpRight className="size-4 shrink-0 text-[#7A8781] group-hover:text-[#0F6B4F]" aria-hidden />
      </div>
      <div className="mt-2"><StatusBadge locale={locale} status={item.status} /></div>
      {preview ? (
        <p className="font-cjk mt-3 line-clamp-3 rounded-[10px] bg-[#F6F7F5] px-3 py-2.5 text-[13px] leading-relaxed text-[#3F4C46]">{preview}</p>
      ) : null}
      <ul className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 pt-4 text-[12.5px]">
        {formats.map((format) => (
          <li key={format} className="flex items-center gap-1.5 text-[#3F4C46]">
            <Check className={`size-3.5 ${item.repurpose ? "text-[#1E9A6E]" : "text-[#C4CBC7]"}`} aria-hidden />
            {format}
          </li>
        ))}
      </ul>
    </Link>
  );
}
