"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { attachRaw } from "@/server/studio-actions";

export function RawFileForm({
  itemId,
  label,
  note,
  button,
}: {
  itemId: string;
  label: string;
  note: string;
  button: string;
}) {
  const [name, setName] = useState("");
  return (
    <form action={attachRaw} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="rawVideoName" value={name} />
      <label className="block text-sm font-medium">
        {label}
        <input
          type="file"
          accept="video/*"
          className="mt-2 block w-full text-sm"
          onChange={(event) => setName(event.target.files?.[0]?.name ?? "")}
        />
      </label>
      <p className="text-sm text-muted-foreground">{note}</p>
      {name ? <p className="text-sm">{name}</p> : null}
      <SubmitButton disabled={!name}>{button}</SubmitButton>
    </form>
  );
}
