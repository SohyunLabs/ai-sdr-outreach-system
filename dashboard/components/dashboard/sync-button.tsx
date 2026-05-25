"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSyncTimestamp } from "@/lib/dashboard-utils";

interface SyncButtonProps {
  lastSyncAt: Date | null;
  onSync: () => Promise<void>;
  syncing: boolean;
}

export function SyncButton({ lastSyncAt, onSync, syncing }: SyncButtonProps) {
  const [result, setResult] = useState<"success" | "error" | null>(null);

  async function handleSync() {
    setResult(null);
    try {
      await onSync();
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className={cn("gap-1.5")}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
        {syncing ? "Syncing..." : "Data Sync"}
        {result === "success" && (
          <span className="text-emerald-600 text-xs ml-1">Done</span>
        )}
        {result === "error" && (
          <span className="text-red-600 text-xs ml-1">Failed</span>
        )}
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatSyncTimestamp(lastSyncAt)}
      </span>
    </div>
  );
}
