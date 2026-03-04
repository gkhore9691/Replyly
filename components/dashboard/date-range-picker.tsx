"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const range: DateRange | undefined = React.useMemo(() => {
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    if (!from && !to) return undefined;
    return { from: from ?? undefined, to: to ?? undefined };
  }, [startDate, endDate]);

  const onSelect = (r: DateRange | undefined) => {
    if (!r?.from) {
      onRangeChange("", "");
      return;
    }
    onRangeChange(format(r.from, "yyyy-MM-dd"), r.to ? format(r.to, "yyyy-MM-dd") : format(r.from, "yyyy-MM-dd"));
    if (r.from && r.to) setOpen(false);
  };

  const label =
    startDate && endDate
      ? `${format(new Date(startDate), "MMM d")} – ${format(new Date(endDate), "MMM d")}`
      : "Pick date range";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-mono text-sm font-normal border-[var(--border)] bg-[#111] text-[var(--fg)] hover:bg-white/[0.06]",
            !range && "text-[var(--muted)]",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={range?.from ?? new Date()}
          selected={range}
          onSelect={onSelect}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}
