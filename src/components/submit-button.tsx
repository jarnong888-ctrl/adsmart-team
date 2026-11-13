"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "…",
  variant = "default",
  disabled,
  className,
  size = "lg",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  disabled?: boolean;
  className?: string;
  size?: "lg" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} className={className} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
