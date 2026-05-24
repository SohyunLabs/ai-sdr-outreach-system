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
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>

        {/* Two-column content skeleton */}
        <main className="flex-1 overflow-y-auto bg-muted/40">
          <div className="px-8 py-8">
            <div className="grid grid-cols-2 gap-8">
              {/* Left column */}
              <div className="flex flex-col gap-6">
                <div className="rounded-lg border bg-card p-6">
                  <Skeleton className="h-4 w-20 mb-4" />
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
              {/* Right column */}
              <div className="flex flex-col gap-6">
                <div className="rounded-lg border bg-card p-6">
                  <Skeleton className="h-4 w-28 mb-4" />
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
