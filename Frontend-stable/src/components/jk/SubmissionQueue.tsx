import { useEffect, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { listPending, removePending } from "@/lib/submissionQueue";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";

export function SubmissionQueue() {
  const online = useOnlineStatus();
  const processing = useRef(false);

  useEffect(() => {
    if (!online || processing.current) return;
    processing.current = true;

    (async () => {
      const pending = await listPending();
      if (pending.length === 0) {
        processing.current = false;
        return;
      }

      const token = getToken() ?? "";
      let sent = 0;

      for (const item of pending) {
        try {
          const url = item.type === "batch" ? "/api/reports/batch" : "/api/analyze";
          const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: item.formData as BodyInit,
          });
          if (!res.ok) continue;
          if (item.id !== undefined) await removePending(item.id);
          sent++;
        } catch {
          // will retry on next online event
        }
      }

      processing.current = false;

      if (sent > 0) {
        toast.success(`${sent} laporan berhasil dikirim`, {
          description: "Antrian offline telah diproses.",
        });
      }
    })();
  }, [online]);

  return null;
}
