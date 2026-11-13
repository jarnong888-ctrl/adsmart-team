"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { saveScript } from "@/server/studio-actions";

const FLAG_LABEL: Record<string, { en: string; zh: string; className: string }> = {
  DEMO: { en: "Demo on screen", zh: "需要实拍", className: "bg-primary/10 text-primary" },
  NEEDS_FACT_CHECK: { en: "Needs fact-check", zh: "待核实", className: "bg-gold/15 text-gold" },
  COMMERCIAL_DISCLOSURE: { en: "Commercial disclosure", zh: "商业披露", className: "bg-persimmon/10 text-persimmon" },
};

function blocksOf(body: string) {
  const chunks = body.split(/\n(?=\[)/);
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const title = lines[0] ?? "";
      const cues = lines.slice(1).map((line) => {
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
      return { title, cues };
    });
}

export function ScriptPanel({
  itemId,
  body,
  flags,
  sources,
  locale,
  canEdit,
}: {
  itemId: string;
  body: string;
  flags: string;
  sources: string;
  locale: "en" | "zh";
  canEdit: boolean;
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
          <span className="rounded-full bg-muted px-3 py-1 text-xs">{zh ? "没有标记" : "No flags"}</span>
        ) : (
          chips.map((flag) => {
            const meta = FLAG_LABEL[flag];
            return (
              <span key={flag} className={`rounded-full px-3 py-1 text-xs font-medium ${meta?.className ?? "bg-muted"}`}>
                {meta ? (zh ? meta.zh : meta.en) : flag}
              </span>
            );
          })
        )}
        <CopyButton text={body} label={zh ? "复制脚本" : "Copy script"} copiedLabel={zh ? "已复制" : "Copied"} />
        {canEdit ? (
          <button type="button" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C5D9D1] bg-[#E6F2ED] px-4 text-[14px] font-bold text-[#0B624C]" onClick={() => setEditing((value) => !value)}>
            {editing ? (zh ? "取消编辑" : "Cancel edit") : zh ? "编辑脚本" : "Edit script"}
          </button>
        ) : null}
      </div>
      {editing ? (
        <form action={saveScript} className="space-y-3">
          <input type="hidden" name="itemId" value={itemId} />
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
          {blocks.map((block) => (
            <article key={block.title} className="rounded-[8px] border border-border bg-card p-4">
              <h3 className="font-mono text-sm text-primary">{block.title}</h3>
              <ul className="mt-3 space-y-2">
                {block.cues.map((cue, index) => (
                  <li key={`${block.title}-${index}`} className="grid grid-cols-[4.5rem_1fr] gap-2 text-sm leading-relaxed">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{cueLabel[cue.kind as keyof typeof cueLabel]}</span>
                    <span>{cue.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {sources ? <p className="text-sm leading-relaxed text-muted-foreground">{sources}</p> : null}
    </div>
  );
}
