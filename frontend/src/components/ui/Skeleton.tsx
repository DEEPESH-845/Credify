interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200${className ? ` ${className}` : ""}`}
    />
  );
}
