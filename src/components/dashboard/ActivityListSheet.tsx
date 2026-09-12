import { ReactNode, useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Heart, Star, CalendarClock } from "lucide-react";
import { CompactFilters } from "@/components/CompactFilters";

export type ActivityFilter =
  | "favorites"
  | "completed"
  | "viewed"
  | "rated"
  | "scheduled"
  | "inprogress";

export interface ActivityItem {
  id: string;
  name: string;
  type: string;
  rating?: number | null;
  is_completed?: boolean;
  is_favorite?: boolean;
  is_viewed?: boolean;
  is_ongoing?: boolean;
  is_scheduled?: boolean;
  scheduled_date?: string | null;
  sort_date?: string | null;
}

interface ActivityListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactNode;
  /** Full list for this kind (workouts or programs) — filtering happens inside. */
  items: ActivityItem[];
  emptyText?: string;
  onItemClick: (item: ActivityItem) => void;
  /** The card that opened the sheet. This status always remains enforced. */
  primaryFilter: ActivityFilter;
  /** Set to false to hide the "In Progress" chip (workouts). */
  showInProgress?: boolean;
}

const matchesFilter = (item: ActivityItem, filter: ActivityFilter) => {
  switch (filter) {
    case "favorites": return !!item.is_favorite;
    case "completed": return !!item.is_completed;
    case "viewed": return !!item.is_viewed;
    case "rated": return !!item.rating && item.rating > 0;
    case "scheduled": return !!item.is_scheduled;
    case "inprogress": return !!item.is_ongoing;
    default: return true;
  }
};

export function ActivityListSheet({
  open,
  onOpenChange,
  title,
  icon,
  items,
  emptyText = "Nothing here yet",
  onItemClick,
  primaryFilter,
  showInProgress = false,
}: ActivityListSheetProps) {
  const [crossFilter, setCrossFilter] = useState<ActivityFilter | "none">("none");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    if (open) setCrossFilter("none");
  }, [open, primaryFilter]);

  const filters: { key: ActivityFilter; label: string }[] = [
    { key: "favorites", label: "Favorites" },
    { key: "completed", label: "Completed" },
    { key: "viewed", label: "Viewed" },
    { key: "rated", label: "Rated" },
    { key: "scheduled", label: "Scheduled" },
    ...(showInProgress ? [{ key: "inprogress" as const, label: "In Progress" }] : []),
  ].filter(({ key }) => key !== primaryFilter);

  const primaryItems = useMemo(
    () => items.filter((item) => matchesFilter(item, primaryFilter)),
    [items, primaryFilter],
  );

  const filterOptions: { value: ActivityFilter | "none"; label: string }[] = [
    { value: "none", label: "No extra filter" },
    ...filters.map(({ key, label }) => ({
      value: key,
      label: `${label} (${primaryItems.filter((item) => matchesFilter(item, key)).length})`,
    })),
  ];

  const visible = useMemo(() => {
    const list = primaryItems.filter((item) => crossFilter === "none" || matchesFilter(item, crossFilter));
    const value = (i: ActivityItem) =>
      new Date(
        (primaryFilter === "scheduled" ? i.scheduled_date : null) || i.sort_date || i.scheduled_date || 0
      ).getTime();
    return [...list].sort((a, b) => (sort === "newest" ? value(b) - value(a) : value(a) - value(b)));
  }, [primaryItems, primaryFilter, crossFilter, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cnPanel}>
        <DialogHeader className="sticky top-0 z-10 bg-background border-b px-5 pt-5 pb-3 text-left space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base pr-10">
            {icon}
            <span>{title}</span>
            <Badge variant="secondary" className="ml-1">{visible.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3 border-b">
          <CompactFilters
            compact
            filters={[
              {
                name: "Also",
                value: crossFilter,
                onChange: (value) => setCrossFilter(value as ActivityFilter | "none"),
                options: filterOptions,
              },
              {
                name: "Sort",
                value: sort,
                onChange: (value) => setSort(value as "newest" | "oldest"),
                options: [
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ],
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {primaryItems.length === 0 ? emptyText : "Nothing matches this filter"}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onItemClick(item);
                    onOpenChange(false);
                  }}
                  className="w-full text-left p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors min-h-[44px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2 break-words">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                        {item.rating ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            {item.rating}
                          </span>
                        ) : null}
                        {item.is_scheduled && item.scheduled_date ? (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-500">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(item.scheduled_date).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.is_completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {item.is_favorite && <Heart className="h-4 w-4 fill-red-500 text-red-500" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 bg-background border-t px-4 py-3">
          <DialogClose asChild>
            <Button variant="outline" className="w-full min-h-11 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Floating panel: mobile = inset with margin from every edge (above bottom nav),
// desktop = right-side floating panel with breathing room from all edges.
const cnPanel = [
  // Reset shadcn defaults
  "p-0 gap-0 max-w-none w-auto max-h-none overflow-hidden",
  "translate-x-0 translate-y-0 left-auto top-auto",
  // Mobile: floating panel inset from all edges, above bottom nav (~3.5rem)
  "fixed left-3 right-3",
  "top-[calc(env(safe-area-inset-top,0px)+4rem)]",
  "bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]",
  "rounded-2xl border shadow-2xl",
  "flex flex-col",
  // Desktop: right-side floating panel
  "sm:left-auto sm:right-6 sm:top-24 sm:bottom-6",
  "sm:w-[440px] sm:max-w-[440px]",
  "sm:rounded-2xl",
].join(" ");
