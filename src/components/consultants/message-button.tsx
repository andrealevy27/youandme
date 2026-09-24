"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Opens (or reuses) the 1:1 consultant thread and navigates to it. */
export function MessageConsultantButton({
  consultantId,
  action,
  label = "Message",
  variant = "primary",
  size = "md",
}: {
  consultantId: string;
  action: (raw: { consultantId: string }) => Promise<Result<{ conversationId: string }>>;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await action({ consultantId });
          if (!res.ok) return void toast.error(res.error);
          router.push(`/messages/${res.data.conversationId}`);
        })
      }
    >
      <MessageCircle /> {label}
    </Button>
  );
}
