"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(copiedLabel);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(label);
        }
      }}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
