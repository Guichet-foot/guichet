export default function FondateurLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div className="h-8 w-48 bg-muted rounded-md" />

      {/* Cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-7 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Main content block */}
      <div className="rounded-xl border bg-card p-0 overflow-hidden">
        <div className="h-12 bg-muted/50 border-b" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded hidden md:block" />
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
