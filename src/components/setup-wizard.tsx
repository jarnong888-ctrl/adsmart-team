"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { Locale } from "@/lib/i18n";
import { saveWorkspace } from "@/server/studio-actions";

type Profile = {
  name: string;
  handle: string;
  industry: string;
  audience: string;
  offers: string;
  tone: string;
  primaryLanguage: string;
  platforms: string[];
  goalFollowers: number;
  goalPlatform: string;
  goalHorizonDays: number;
  baselineFollowers: number;
  baselineOn: string;
  postingCapacity: number;
  mixMindset: number;
  mixPractical: number;
  mixTrends: number;
  softSellRatio: number;
};

const control = "mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function SetupWizard({ locale, profile }: { locale: Locale; profile: Profile }) {
  const zh = locale === "zh";
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(profile);
  const steps = zh
    ? ["你的生意", "卖给谁", "怎么说话", "目标"]
    : ["The business", "Who you sell to", "Voice", "The goal"];
  const set = (key: keyof Profile, value: string | number | string[]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="max-w-xl">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={zh ? "设置进度" : "Setup progress"}>
        {steps.map((label, index) => (
          <li key={label}>
            <div className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
            <p className={`mt-2 text-xs ${index === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {index + 1}. {label}
            </p>
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <div className="space-y-3">
          <Field label={zh ? "商家名称" : "Business name"}>
            <input className={control} value={draft.name} onChange={(event) => set("name", event.target.value)} />
          </Field>
          <Field label={zh ? "行业" : "Industry"}>
            <input className={control} value={draft.industry} onChange={(event) => set("industry", event.target.value)} />
          </Field>
          <Field label={zh ? "账号" : "Handle"}>
            <input className={control} value={draft.handle} onChange={(event) => set("handle", event.target.value)} placeholder="@name" />
          </Field>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="space-y-3">
          <Field label={zh ? "你想吸引的人" : "Who should watch"}>
            <textarea className={`${control} min-h-24 py-2`} value={draft.audience} onChange={(event) => set("audience", event.target.value)} />
          </Field>
          <Field label={zh ? "你卖什么，顺序是什么" : "What you sell, in order"}>
            <textarea className={`${control} min-h-28 py-2`} value={draft.offers} onChange={(event) => set("offers", event.target.value)} />
          </Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <Field label={zh ? "说话的语气" : "Tone"}>
            <input className={control} value={draft.tone} onChange={(event) => set("tone", event.target.value)} />
          </Field>
          <Field label={zh ? "内容语言" : "Content language"}>
            <select className={control} value={draft.primaryLanguage} onChange={(event) => set("primaryLanguage", event.target.value)}>
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ms">Bahasa Melayu</option>
            </select>
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">{zh ? "发到哪里" : "Where you post"}</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {["tiktok", "instagram", "facebook"].map((platform) => (
                <label key={platform} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.platforms.includes(platform)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...draft.platforms, platform]
                        : draft.platforms.filter((item) => item !== platform);
                      set("platforms", next);
                    }}
                  />
                  {platform}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      {step === 3 ? (
        <form action={saveWorkspace} className="space-y-3">
          <input type="hidden" name="name" value={draft.name} />
          <input type="hidden" name="handle" value={draft.handle} />
          <input type="hidden" name="industry" value={draft.industry} />
          <input type="hidden" name="audience" value={draft.audience} />
          <input type="hidden" name="offers" value={draft.offers} />
          <input type="hidden" name="tone" value={draft.tone} />
          <input type="hidden" name="primaryLanguage" value={draft.primaryLanguage} />
          {draft.platforms.map((platform) => (
            <input key={platform} type="hidden" name={`platform_${platform}`} value="on" />
          ))}
          <input type="hidden" name="mixMindset" value={draft.mixMindset} />
          <input type="hidden" name="mixPractical" value={draft.mixPractical} />
          <input type="hidden" name="mixTrends" value={draft.mixTrends} />
          <input type="hidden" name="softSellRatio" value={draft.softSellRatio} />
          <input type="hidden" name="postingCapacity" value={draft.postingCapacity} />
          <input type="hidden" name="baselineFollowers" value={draft.baselineFollowers} />
          <input type="hidden" name="baselineOn" value={draft.baselineOn} />
          <Field label={zh ? "粉丝目标" : "Follower goal"}>
            <input className={control} name="goalFollowers" type="number" value={draft.goalFollowers} onChange={(event) => set("goalFollowers", Number(event.target.value))} />
          </Field>
          <Field label={zh ? "目标平台" : "Goal platform"}>
            <select className={control} name="goalPlatform" value={draft.goalPlatform} onChange={(event) => set("goalPlatform", event.target.value)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </Field>
          <Field label={zh ? "多少天内达到" : "Days to get there"}>
            <input className={control} name="goalHorizonDays" type="number" value={draft.goalHorizonDays} onChange={(event) => set("goalHorizonDays", Number(event.target.value))} />
          </Field>
          <SubmitButton>{zh ? "保存并开始" : "Save and start"}</SubmitButton>
        </form>
      ) : (
        <div className="mt-5 flex gap-2">
          {step > 0 ? (
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#C5D9D1] bg-[#E6F2ED] px-4 text-[14px] font-bold text-[#0B624C]" onClick={() => setStep((value) => value - 1)}>
              {zh ? "上一步" : "Back"}
            </button>
          ) : null}
          <button type="button" className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#086B54] bg-[#0B624C] px-4 text-[14px] font-bold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#094E3D]" onClick={() => setStep((value) => value + 1)}>
            {zh ? "下一步" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
