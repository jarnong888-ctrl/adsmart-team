import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { RawFileForm } from "@/components/raw-file-form";
import { ScriptPanel } from "@/components/script-panel";
import { FlagChip, StatusBadge } from "@/components/status-badge";
import { listFactFlags } from "@/lib/pipeline";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays, formatWhen } from "@/lib/dates";
import { pillarLabel, tr } from "@/lib/i18n";
import { requiresFactCheckAck } from "@/lib/pipeline";
import { saveToDrive } from "@/server/integration-actions";
import { approveScript, briefItem, generateScript, queueItem, repurposeItem } from "@/server/studio-actions";
import { studioContext } from "@/server/context";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string; ack?: string; from?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const { id } = await params;
  const sp = await searchParams;
  const item = await prisma.contentItem.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { plan: true, script: true, repurpose: true, brief: true, schedule: { orderBy: { scheduledFor: "asc" } } },
  });
  if (!item) notFound();
  const drive = await prisma.integration.findUnique({ where: { workspaceId_provider: { workspaceId: workspace.id, provider: "google" } } });
  const days = locale === "zh" ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <Link href={sp.from === "scripts" ? `/studio/scripts?item=${item.id}` : "/studio/pipeline"} className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[#5E6B65] hover:text-[#14201B]">
        ← {sp.from === "scripts" ? tr(locale, "Back to Scripts", "返回脚本") : tr(locale, "Back to the pipeline", "返回流水线")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge locale={locale} status={item.status} />
        <span className="text-sm text-muted-foreground">
          {days[item.dayIndex]} {addDays(item.plan.weekStart, item.dayIndex)} · {pillarLabel(locale, item.pillar)} · {item.language.toUpperCase()}
          {item.softSell ? ` · ${tr(locale, "soft sell", "软性销售")}` : ""}
        </span>
      </div>
      <h1 className="font-cjk mt-3 max-w-3xl text-[26px] leading-[1.3] font-semibold">{item.title}</h1>
      <p className="font-cjk mt-2 max-w-3xl text-[15px] leading-[1.7] text-[#3F4C46]">{item.angle}</p>
      <dl className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{tr(locale, "Hook", "钩子")}</dt>
          <dd className="mt-1 text-sm">{item.hook}</dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{tr(locale, "CTA", "行动")}</dt>
          <dd className="mt-1 text-sm">{item.cta}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            {tr(locale, "Comment keyword", "评论关键词")} · {item.commentKeyword}
          </dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section>
        <div className="mb-3 flex flex-wrap gap-1">
          {(item.script?.flags ?? "").split(",").filter(Boolean).map((flag) => (
            <FlagChip key={flag} locale={locale} flag={flag.trim()} />
          ))}
        </div>
        {item.script?.flags.includes("NEEDS_FACT_CHECK") ? (
          <p className="mb-3 rounded-[8px] border border-[#EED6A3] bg-[#FDF6E7] px-3 py-2 text-[13px] leading-[1.55] text-[#3F4C46]">
            <span className="font-medium text-[#B45309]">{tr(locale, "Do not add a number with no source.", "口播里不要加没有出处的数字。")}</span>
            {" "}
            {tr(locale, "You can approve this script. Confirm the flagged lines in the dialog first. That acknowledgement is logged, and the flags stay.", "这条脚本可以批准。先在对话框里确认列出的标记。这次确认会记入批准记录，标记不会消失。")}
          </p>
        ) : null}
        <h2 className="text-[16px] font-semibold">{tr(locale, "Script", "脚本")}</h2>
        {item.script && drive?.status === "connected" ? (
          <form action={saveToDrive} className="mt-3">
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton variant="outline">{tr(locale, "Save to Drive", "存到 Drive")}</SubmitButton>
          </form>
        ) : null}
        {item.script ? (
          <ScriptPanel
            itemId={item.id}
            body={item.script.body}
            flags={item.script.flags}
            sources={item.script.sources}
            locale={locale}
            canEdit={user.platformRole !== "admin"}
          />
        ) : item.status === "plan_approved" ? (
          <form action={generateScript} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="text-sm">
              {tr(locale, "Language", "语言")}
              <select name="language" defaultValue={item.language} className="mt-1 block h-10 rounded-lg border border-input bg-card px-3">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
              </select>
            </label>
            <SubmitButton>{tr(locale, "Write the script", "写脚本")}</SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{tr(locale, "Approve the week before a script can be written.", "先批准这一周，才能写脚本。")}</p>
        )}
      </section>
      <aside className="h-fit rounded-[8px] border border-[#E4E8E5] bg-white p-4">
        <h2 className="text-[14px] font-semibold">{tr(locale, "Next", "下一步")}</h2>
        <p className="mt-1 text-[13px] leading-[1.55] text-[#5E6B65]">{nextHint(locale, item.status)}</p>
        <div className="mt-3 space-y-2">
          {item.status === "script_ready" ? (
            <form action={repurposeItem}><input type="hidden" name="itemId" value={item.id} /><SubmitButton variant="outline" className="w-full">{tr(locale, "Turn this script into other formats", "把这条脚本改写成其他格式")}</SubmitButton></form>
          ) : null}
          {item.status === "repurposed" ? (
            <form action={briefItem}><input type="hidden" name="itemId" value={item.id} /><SubmitButton variant="outline" className="w-full">{tr(locale, "Write the edit brief", "生成剪辑单")}</SubmitButton></form>
          ) : null}
          {item.script && !item.script.approvedAt && item.status === "script_ready" && user.platformRole !== "admin" ? (
            requiresFactCheckAck(item.script.flags, item.script.body) ? (
              <Link href={`/studio/pipeline/${item.id}?ack=1`} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#0F6B4F] bg-[#0F6B4F] px-4 text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#0A5540]">{tr(locale, "Approve script", "批准脚本")}</Link>
            ) : (
              <form action={approveScript}><input type="hidden" name="itemId" value={item.id} /><SubmitButton>{tr(locale, "Approve script", "批准脚本")}</SubmitButton></form>
            )
          ) : item.script?.approvedAt ? <p className="text-[13px] text-[#0F6B4F]">{tr(locale, "Script approved. Open fact-checks stay on it.", "脚本已批准。待核实标记还在。")}</p> : null}
          {item.script && sp.ack === "1" && requiresFactCheckAck(item.script.flags, item.script.body) ? (
            <FactDialog locale={locale} itemId={item.id} flags={listFactFlags(item.script.body, item.script.flags)} />
          ) : null}
        </div>
      </aside>
      </div>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Repurpose", "改写")}</h2>
        {item.repurpose ? (
          <div className="mt-3 space-y-3">
            <Block title={tr(locale, "Instagram caption", "Instagram 文案")} body={item.repurpose.igCaption} />
            <Block title={tr(locale, "Carousel", "轮播")} body={item.repurpose.carouselOutline} />
            <Block title={tr(locale, "Facebook", "Facebook")} body={item.repurpose.facebookPost} />
            <Block title={tr(locale, "Sizes", "尺寸")} body={item.repurpose.sizeNotes} />
          </div>
        ) : item.status === "script_ready" ? (
          <form action={repurposeItem} className="mt-3">
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton>{tr(locale, "Repurpose this script", "把这条脚本改写成其他格式")}</SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{tr(locale, "A script comes first.", "要先有脚本。")}</p>
        )}
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Edit brief", "剪辑单")}</h2>
        {item.brief ? (
          <div className="mt-3 space-y-3">
            <Block title={tr(locale, "Cuts", "剪点")} body={item.brief.cuts} />
            <Block title={tr(locale, "Captions", "字幕")} body={item.brief.captions} />
            <Block title={tr(locale, "Aspect ratios", "画幅")} body={item.brief.aspectRatios} />
            <Block title={tr(locale, "Music", "音乐")} body={item.brief.musicNote} />
            {item.brief.rawVideoName ? <p className="text-sm">{tr(locale, "Raw filename", "素材文件名")} · {item.brief.rawVideoName}</p> : null}
            <RawFileForm
              itemId={item.id}
              label={tr(locale, "Raw video", "原始视频")}
              note={tr(locale, "The file stays on your computer. This MVP only stores the filename on the brief.", "文件留在你的电脑上。这个 MVP 只在剪辑单上记下文件名。")}
              button={tr(locale, "Save filename", "保存文件名")}
            />
          </div>
        ) : item.status === "repurposed" ? (
          <form action={briefItem} className="mt-3">
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton>{tr(locale, "Write the edit brief", "写剪辑单")}</SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{tr(locale, "Repurpose the script before the edit brief.", "先改写，再写剪辑单。")}</p>
        )}
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Schedule", "排期")}</h2>
        {item.schedule.length === 0 && item.status === "brief_ready" ? (
          <form action={queueItem} className="mt-3 space-y-2">
            <input type="hidden" name="itemId" value={item.id} />
            <p className="text-sm text-muted-foreground">{tr(locale, "Queueing does not publish. One later approval schedules every platform of this video.", "放进队列不会发出。之后点一次批准，就会排到这条视频的每个平台。")}</p>
            <SubmitButton>{tr(locale, "Add to the queue", "放进队列")}</SubmitButton>
          </form>
        ) : null}
        <ul className="mt-3 space-y-2">
          {item.schedule.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge locale={locale} status={entry.status} />
                <span>{entry.platform}</span>
                <span className="text-muted-foreground">{formatWhen(entry.scheduledFor, locale)}</span>
                <span className="text-muted-foreground">{entry.publisherKey}</span>
              </div>
              {entry.externalId ? <p className="mt-2 text-xs text-muted-foreground">{entry.externalId}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FactDialog({
  locale,
  itemId,
  flags,
}: {
  locale: "en" | "zh";
  itemId: string;
  flags: { where: string; quote: string }[];
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#14201B]/35 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[8px] border border-[#E4E8E5] bg-white p-4">
        <h2 className="type-h2">{tr(locale, "Fact-check", "待核实")}</h2>
        <p className="mt-2 text-[13px] leading-[1.55] text-[#3F4C46]">
          {tr(locale, `${flags.length} open. You can still approve. This yes is logged.`, `${flags.length} 处未核实。仍可批准。确认会被记录。`)}
        </p>
        <ul className="mt-3 space-y-2">
          {flags.map((flag, index) => (
            <li key={`${flag.where}-${index}`} className="rounded-[6px] border border-[#EED6A3] bg-[#FDF6E7] px-3 py-2 text-[13px]">
              <p className="font-medium text-[#B45309]">{index + 1} · {flag.where}</p>
              <p className="mt-1 leading-[1.55] text-[#3F4C46]">{flag.quote}</p>
            </li>
          ))}
        </ul>
        <form action={approveScript} className="mt-4 space-y-3">
          <input type="hidden" name="itemId" value={itemId} />
          <label className="flex items-start gap-2 text-[13px] leading-[1.55]">
            <input type="checkbox" name="acknowledge" value="on" required className="mt-1" />
            <span>
              {tr(locale, "I’ve checked these and still want to approve", "我已核对这些内容，仍要批准")}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Link href={`/studio/pipeline/${itemId}`} className="inline-flex h-9 items-center rounded-[6px] border border-[#DCE1DE] px-3 text-[13px]">{tr(locale, "Cancel", "取消")}</Link>
            <SubmitButton>{tr(locale, "Approve script", "批准脚本")}</SubmitButton>
          </div>
        </form>
        <p className="mt-3 text-[13px] text-[#5E6B65]">{tr(locale, "Tick to enable approve. Flags do not block the script.", "勾选后才能批准。标记不会挡住脚本。")}</p>
      </div>
    </div>
  );
}

function nextHint(locale: "en" | "zh", status: string) {
  switch (status) {
    case "planned":
      return tr(locale, "Approve the week first. Nothing is written until then.", "先批准这一周。批准前不会写任何内容。");
    case "plan_approved":
      return tr(locale, "Write the script. After that come formats, the edit brief and the queue.", "先写脚本，之后是改写、剪辑单和排队。");
    case "script_ready":
      return tr(locale, "Approve the script, then turn it into other formats. Scheduling happens when you approve the finished post.", "批准脚本，然后改写成其他格式。批准做好的内容时才会排期。");
    case "repurposed":
      return tr(locale, "Write the edit brief next.", "下一步写剪辑单。");
    case "brief_ready":
      return tr(locale, "Add it to the queue. Queueing does not post; one approval later schedules every platform.", "放进队列。放进队列不会发出，之后批准一次会排到所有平台。");
    case "queued":
      return tr(locale, "Waiting for your approval in Schedule. There is no separate publish step.", "在排期里等你批准。不需要再点发布。");
    case "schedule_approved":
      return tr(locale, "Approved and scheduled. It goes out at the planned time.", "已批准并排期，会在计划时间发出。");
    case "published":
      return tr(locale, "Posted. Record views and followers in Analytics.", "已发出。在数据页记录播放和粉丝。");
    default:
      return "";
  }
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[8px] border border-border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <pre className="mt-2 font-sans text-sm leading-relaxed whitespace-pre-wrap">{body}</pre>
    </article>
  );
}
