import { cn } from "@/utils/cn";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="aspect-4/3 rounded-[1.75rem] bg-bun-line" />
      <div className="mt-4 space-y-3 px-1">
        <div className="h-6 w-3/4 rounded bg-bun-line" />
        <div className="h-4 w-1/2 rounded bg-bun-line" />
        <div className="h-4 w-2/3 rounded bg-bun-line" />
      </div>
    </div>
  );
}