import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const parseDateValue = (value) => {
  const normalized = String(value || "").trim()
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const nextDate = new Date(year, month - 1, day)
  if (
    Number.isNaN(nextDate.getTime()) ||
    nextDate.getFullYear() !== year ||
    nextDate.getMonth() !== month - 1 ||
    nextDate.getDate() !== day
  ) {
    return undefined
  }
  return nextDate
}

const toDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  id,
  allowClear = false,
  className,
  buttonClassName,
  contentClassName,
}) {
  const selectedDate = React.useMemo(() => parseDateValue(value), [value])

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {selectedDate ? format(selectedDate, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn("w-auto p-0", contentClassName)}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? toDateValue(date) : "")}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {allowClear && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-8 w-8 shrink-0"
          onClick={() => onChange("")}
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}

export { DatePicker }
