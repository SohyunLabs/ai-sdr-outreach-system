import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center px-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="ml-3 h-4 w-24" />
        </div>
        <div className="flex flex-col gap-1 px-3 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header skeleton */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>

        {/* Content skeleton */}
        <main className="flex-1 overflow-y-auto bg-muted/40">
          <div className="px-8 py-8">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            {/* Table skeleton */}
            <Skeleton className="h-10 w-full rounded-md mb-4" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md mb-2" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
