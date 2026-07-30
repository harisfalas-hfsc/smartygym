import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DesktopPageIntroProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

/**
 * Desktop-only page intro: icon on top, headline, then wide description
 * (no card wrapper). Mobile keeps its own description card.
 */
export const DesktopPageIntro = ({ icon: Icon, title, children }: DesktopPageIntroProps) => (
  <section className="hidden lg:block mb-10 text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
      <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
    </div>
    <h2 className="mb-4 text-3xl xl:text-4xl font-extrabold uppercase tracking-tight text-foreground">
      {title}
    </h2>
    <div className="mx-auto max-w-5xl space-y-3 text-base xl:text-lg leading-relaxed text-muted-foreground">
      {children}
    </div>
  </section>
);
