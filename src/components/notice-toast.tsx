"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function NoticeToast({
  message,
  kind,
}: {
  message: string | null;
  kind: "success" | "error" | null;
}) {
  const seen = useRef("");
  useEffect(() => {
    if (!message || !kind || seen.current === `${kind}:${message}`) return;
    seen.current = `${kind}:${message}`;
    if (kind === "error") toast.error(message);
    else toast.success(message);
  }, [message, kind]);
  return null;
}
