"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { saveScript } from "@/server/studio-actions";

const FLAG_LABEL: Record<string, { en: string; zh: string; className: string }> = {
  DEMO: { en: "Demo on screen", zh: "需要实拍", className: "bg-[#E8F0FB] text-[#1A4F9E]" },
  NEEDS_FACT_CHECK: { en: "Needs fact-check", zh: "待核实", className: "bg-[#FDF3E1] text-[#7A4F00]" },
  COMMERCIAL_DISCLOSURE: { en: "Commercial disclosure", zh: "商业披露", className: "bg-[#FCEBDD] text-[#8F3A0A]" },
};

function blocksOf(body: string) {
  const chunks = body.split(/\n(?=\[)/);
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const title = lines[0] ?? "";
      const head = title.match(/^\[([^\]]+)\]\s*(.*)$/);
      const cues = lines.slice(1).filter((line) => line.trim() !== "").map((line) => {
        const match = line.match(/^(画面|字幕|口播|Visual|Sari kata|Tutur|Subtitle|Spoken)[:：]\s*(.*)$/);
        if (!match) return { kind: "note", text: line };
        const key = match[1];
        const kind =
          key === "画面" || key === "Visual"
            ? "visual"
            : key === "字幕" || key === "Sari kata" || key === "Subtitle"
              ? "subtitle"
              : "spoken";
        return { kind, text: match[2] };
      });
      return { title, time: head?.[1] ?? "", label: head ? head[2] : title, cues };
    });
}

export function ScriptPanel({
  itemId,
  body,
  flags,
  sources,
  locale,
  canEdit,
  returnTo,
}: {
  itemId: string;
  body: string;
  flags: string;
  sources: string;
  locale: "en" | "zh";
  canEdit: boolean;
  returnTo?: string;
}) {
  const [editing, setEditing] = useState(false);
  const zh = locale === "zh";
  const chips = flags.split(",").map((flag) => flag.trim()).filter(Boolean);
  const blocks = blocksOf(body);
  const cueLabel = {
    visual: zh ? "画面" : "Visual",
    subtitle: zh ? "字幕" : "Subtitle",
    spoken: zh ? "口播" : "Spoken",
    note: zh ? "备注" : "Note",
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.length === 0 ? (
          <span className="inline-flex h-7 items-center gap-1.5 text-[12.5px] text-[#3F4C46]">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="#1E9A6E" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
            {zh ? "没有标记" : "No flags"}
          </span>
        ) : (
          chips.map((flag) => {
            const meta = FLAG_LABEL[flag];
            return (
              <span key={flag} className={`inline-flex h-7 items-center rounded-full px-2.5 text-[12.5px] font-medium ${meta?.className ?? "bg-muted"}`}>
                {meta ? (zh ? meta.zh : meta.en) : flag}
              </span>
            );
          })
        )}
        <CopyButton text={body} label={zh ? "复制脚本" : "Copy script"} copiedLabel={zh ? "已复制" : "Copied"} />
        {canEdit ? (
          <button type="button" className="inline-flex h-9 items-center justify-center rounded-[10px] border border-[#DCE1DE] bg-white px-3.5 text-[13.5px] font-medium text-[#14201B] hover:bg-[#F1F3F2]" onClick={() => setEditing((value) => !value)}>
            {editing ? (zh ? "取消编辑" : "Cancel edit") : zh ? "编辑脚本" : "Edit script"}
          </button>
        ) : null}
      </div>
      {editing ? (
        <form action={saveScript} className="space-y-3">
          <input type="hidden" name="itemId" value={itemId} />
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <label className="block text-sm font-medium" htmlFor="script-body">
            {zh ? "脚本正文" : "Script"}
            <textarea
              id="script-body"
              name="body"
              defaultValue={body}
              className="mt-1 min-h-72 w-full rounded-xl border border-input bg-card px-3 py-3 text-base leading-relaxed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </label>
          <SubmitButton>{zh ? "保存脚本" : "Save script"}</SubmitButton>
        </form>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, blockIndex) => (
            <article key={`${block.title}-${blockIndex}`} className="rounded-[12px] border border-[#E4E8E5] bg-white px-4 py-3.5">
              <h3 className="flex flex-wrap items-center gap-2.5">
                {block.time ? (
                  <span className="rounded-[6px] bg-[#14201B] px-2 py-0.5 font-mono text-[12px] font-medium tracking-tight text-white">{block.time}</span>
                ) : null}
                <span className="font-cjk text-[14px] font-semibold">{block.label}</span>
              </h3>
              <dl className="mt-2.5 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                {block.cues.map((cue, index) => (
                  <div key={`${block.title}-${index}`} className="contents">
                    <dt className="pt-[3px] text-[12px] font-medium text-[#5E6B65]">{cueLabel[cue.kind as keyof typeof cueLabel]}</dt>
                    <dd className={`font-cjk text-[14.5px] leading-[1.65] ${cue.kind === "subtitle" ? "font-medium" : ""}`}>{cue.text}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
      {sources ? <p className="text-[13px] leading-relaxed text-[#5E6B65]"><span className="font-medium text-[#3F4C46]">{zh ? "来源：" : "Sources: "}</span>{sources}</p> : null}
    </div>
  );
}
