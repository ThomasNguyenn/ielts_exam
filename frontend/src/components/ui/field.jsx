"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

const FieldGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn("flex flex-col gap-4", className)}
    {...props}
  />
))
FieldGroup.displayName = "FieldGroup"

const Field = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field"
    className={cn("grid gap-2", className)}
    {...props}
  />
))
Field.displayName = "Field"

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => (
  <Label
    ref={ref}
    data-slot="field-label"
    className={cn("text-sm font-medium", className)}
    {...props}
  />
))
FieldLabel.displayName = "FieldLabel"

const FieldDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
FieldDescription.displayName = "FieldDescription"

const FieldSeparator = React.forwardRef(
  ({ className, children = "Or continue with", ...props }, ref) => (
    <div
      ref={ref}
      data-slot="field-separator"
      className={cn("flex items-center gap-3 py-1", className)}
      {...props}
    >
      <Separator className="flex-1" />
      <span
        data-slot="field-separator-content"
        className="rounded-md bg-background px-2 text-xs text-muted-foreground"
      >
        {children}
      </span>
      <Separator className="flex-1" />
    </div>
  ),
)
FieldSeparator.displayName = "FieldSeparator"

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator }
