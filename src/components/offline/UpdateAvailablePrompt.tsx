import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { onServiceWorkerUpdate, applyServiceWorkerUpdate } from "@/utils/registerServiceWorker";

export const UpdateAvailablePrompt = () => {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => onServiceWorkerUpdate(() => setWaiting(true)), []);

  if (!waiting) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
      <div className="flex items-center gap-3 text-sm">
        <span>New version available</span>
        <Button size="sm" variant="default" onClick={() => applyServiceWorkerUpdate()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    </div>
  );
};
