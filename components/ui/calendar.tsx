"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        ...components,
      }}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-[var(--fg)]",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-[var(--border)]"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-[var(--muted)] rounded-sm w-9 font-mono text-[0.8rem] font-normal",
        row: "flex w-full mt-2",
        cell: "relative p-0 text-center text-sm focus-within:relative",
        day: cn(
          "h-9 w-9 p-0 font-mono font-normal rounded-sm",
          "hover:bg-white/[0.08] focus:bg-white/[0.08]",
          "aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start rounded-l-sm",
        day_range_end: "day-range-end rounded-r-sm",
        day_selected:
          "bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent)] hover:text-[var(--bg)] focus:bg-[var(--accent)] focus:text-[var(--bg)]",
        day_today: "bg-white/[0.06] text-[var(--fg)]",
        day_outside:
          "day-outside text-[var(--muted)] opacity-50 aria-selected:opacity-30",
        day_disabled: "text-[var(--muted)] opacity-50",
        day_range_middle:
          "aria-selected:bg-[var(--accent)]/20 aria-selected:text-[var(--fg)]",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar, type DateRange };
