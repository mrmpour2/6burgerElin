import { SkeletonCard } from "./SkeletonCard";
export function SkeletonLoader() {
  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}