import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DesktopPageIntroProps {
  icon: LucideIcon;
  title: string;
  /** Heading level for the title. Defaults to h1 (page-level heading). */
  headingLevel?: "h1" | "h2";
  children: ReactNode;
}

/**
 * Desktop-only page intro: icon on top, headline, then wide description
 * (no card wrapper). Mobile keeps its own description card.
 */
export const DesktopPageIntro = ({ icon: Icon, title, headingLevel = "h1", children }: DesktopPageIntroProps) => {
  const Heading = headingLevel;
  return (
  <section className="hidden lg:block mb-10 text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
      <Icon className="h-10 w-10 text-primary" aria-hidden="true" />
    </div>
    <Heading className="mb-4 text-3xl xl:text-4xl font-extrabold uppercase tracking-tight text-primary">
      {title}
    </Heading>
    <div className="mx-auto max-w-5xl space-y-3 text-base xl:text-lg leading-relaxed text-muted-foreground">
      {children}
    </div>
  </section>
  );
};
