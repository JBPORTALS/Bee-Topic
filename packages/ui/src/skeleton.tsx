import { cn } from "@bt/ui";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-accent/40", className)}
      {...props}
    />
  );
}

export { Skeleton };
