import { useEffect, useState } from "react";
import { ExternalLink, Sparkles, ChevronLeft } from "lucide-react";
import logoMove from "@/assets/smartymove-logo.png";
import logoDiet from "@/assets/smartydiet-logo.png";
import logoGym from "@/assets/smarty-gym-logo.png";
import { useOverlayZIndex } from "@/lib/overlayActivity";

// Change this constant when porting the component to the other two projects.
const CURRENT_APP: "gym" | "move" | "diet" = "gym";

type SisterApp = {
  id: "gym" | "move" | "diet";
  name: string;
  tagline: string;
  url: string;
  image: string;
};

const SISTER_APPS: SisterApp[] = [
  {
    id: "gym",
    name: "SmartyGym",
    tagline: "Train smart. Get stronger. Feel younger.",
    url: "https://smartygym.com",
    image: logoGym,
  },
  {
    id: "move",
    name: "SmartyMove",
    tagline: "Check your posture. Correct your movement. Live better.",
    url: "https://smartymove.com",
    image: logoMove,
  },
  {
    id: "diet",
    name: "SmartyDiet",
    tagline: "Eat smart. Fuel your body. Live longer.",
    url: "https://smartydiet.com",
    image: logoDiet,
  },
];

const DELAY_MS = 30000;

export const SisterAppsPopup = () => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const zIndex = useOverlayZIndex(open);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setMounted(true);
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const others = SISTER_APPS.filter((a) => a.id !== CURRENT_APP);

  if (!mounted) return null;

  return (
    <>
      <div
        aria-hidden={!open}
        style={{ zIndex }}
        className={`fixed top-1/2 -translate-y-1/2 left-0 flex items-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "-translate-x-[calc(100%+10px)]"}`}
      >
        <aside className="w-[260px] pl-4 pr-2 py-4 bg-white rounded-r-2xl shadow-[4px_0_24px_rgba(15,23,42,0.12)]">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 text-primary text-[11px] font-extrabold uppercase tracking-[0.2em]">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Smarty Family
            </span>
            <h2 className="mt-1 text-[15px] font-bold text-slate-900 leading-tight">
              Complete your wellness journey
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {others.map((app) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 py-1 transition-transform duration-300 hover:translate-x-1 focus-visible:outline-none"
              >
                <div className="h-14 w-14 shrink-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                  <img
                    src={app.image}
                    alt={app.name}
                    loading="lazy"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight group-hover:text-primary transition-colors">{app.name}</h3>
                  <p className="text-[11px] font-medium text-slate-700 leading-snug line-clamp-2 mt-0.5">{app.tagline}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
              </a>
            ))}
          </div>
        </aside>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide panel"
          className="h-12 w-6 rounded-r-full bg-white text-slate-900 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-[4px_0_12px_rgba(15,23,42,0.08)]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show sister apps"
        style={{ zIndex: Math.max(1, zIndex - 1) }}
        className={`fixed top-1/2 -translate-y-1/2 left-0 w-2 h-24 rounded-r-full bg-primary shadow-[0_0_28px_hsl(var(--primary)/0.65)] hover:w-3 hover:bg-primary transition-all duration-300 ${open ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Show sister apps"
          style={{ zIndex: Math.max(1, zIndex - 2) }}
          className="fixed top-1/2 -translate-y-1/2 left-0 w-6 h-20 opacity-0"
        />
      )}
    </>
  );
};

export default SisterAppsPopup;
