import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const emptyMediaVariants = cva("flex items-center justify-center", {
  variants: {
    variant: {
      default: "",
      icon: "h-12 w-12 rounded-full border bg-background text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const Empty = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex w-full flex-col items-center justify-center gap-4 rounded-lg p-6 text-center", className)}
      {...props}
    />
  ),
);
Empty.displayName = "Empty";

const EmptyHeader = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col items-center gap-2", className)} {...props} />
  ),
);
EmptyHeader.displayName = "EmptyHeader";

const EmptyMedia = React.forwardRef(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(emptyMediaVariants({ variant }), className)} {...props} />
  ),
);
EmptyMedia.displayName = "EmptyMedia";

const EmptyTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <h4 ref={ref} className={cn("text-base font-semibold text-foreground", className)} {...props} />
  ),
);
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("max-w-md text-sm text-muted-foreground", className)} {...props} />
  ),
);
EmptyDescription.displayName = "EmptyDescription";

const EmptyContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-center gap-2", className)} {...props} />
  ),
);
EmptyContent.displayName = "EmptyContent";

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
