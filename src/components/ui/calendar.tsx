import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { type DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "relative bg-surface-panel text-text-high font-body p-6",
        "border border-line-soft/20 clip-diagonal-br scanlines-overlay",
        "[--cell-size:--spacing(12)]",
        "group/calendar",
        className,
      )}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }).toUpperCase(),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-6 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 text-text-low hover:text-brand-core aria-disabled:opacity-40",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) select-none p-0 text-text-low hover:text-brand-core aria-disabled:opacity-40",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          "font-heading text-sm font-bold uppercase tracking-widest text-text-high",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-2 text-sm font-heading uppercase tracking-widest",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative border border-line-soft/30 bg-surface-panel-strong px-2",
          "has-focus:border-brand-core",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "absolute inset-0 bg-transparent text-text-high opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-heading text-sm font-bold uppercase tracking-widest text-text-high",
          "[&>svg]:size-3.5 [&>svg]:text-text-low",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn(
          "flex gap-1 border-b border-line-soft/20 pb-2 mb-2",
          defaultClassNames.weekdays,
        ),
        weekday: cn(
          "flex-1 select-none text-[10px] font-heading uppercase tracking-widest text-text-low",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full gap-1", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "select-none text-[10px] font-heading uppercase tracking-widest text-text-low",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square w-full select-none p-0 text-center",
          defaultClassNames.day,
        ),
        range_start: cn("bg-brand-core/10", defaultClassNames.range_start),
        range_middle: cn("bg-brand-core/10", defaultClassNames.range_middle),
        range_end: cn("bg-brand-core/10", defaultClassNames.range_end),
        today: cn(
          "[&>button]:border [&>button]:border-brand-core/60 [&>button]:text-brand-core",
          defaultClassNames.today,
        ),
        outside: cn("text-text-low/40 aria-selected:text-text-low/60", defaultClassNames.outside),
        disabled: cn("text-text-low/30 pointer-events-none", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rootProps} />
        ),
        Chevron: ({ className, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...chevronProps} />;
          }
          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...chevronProps} />;
          }
          return (
            <ChevronRightIcon className={cn("size-4 rotate-90", className)} {...chevronProps} />
          );
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...weekProps }) => (
          <td {...weekProps}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-auto h-full w-full flex-col items-center justify-center gap-1 p-0",
        "font-label text-sm tabular-nums leading-none tracking-tight",
        "border border-transparent hover:border-brand-core/50 hover:bg-brand-core/5 hover:text-text-high",
        "focus-visible:border-brand-core focus-visible:ring-1 focus-visible:ring-brand-core/40",
        "data-[selected-single=true]:bg-brand-core data-[selected-single=true]:text-text-on-brand data-[selected-single=true]:border-brand-core",
        "data-[selected-single=true]:font-bold",
        "data-[selected-single=true]:shadow-[0_0_12px_color-mix(in_srgb,var(--brand-core)_40%,transparent)]",
        "data-[range-start=true]:bg-brand-core data-[range-start=true]:text-text-on-brand data-[range-start=true]:font-bold",
        "data-[range-end=true]:bg-brand-core data-[range-end=true]:text-text-on-brand data-[range-end=true]:font-bold",
        "data-[range-middle=true]:bg-brand-core/10 data-[range-middle=true]:text-text-high data-[range-middle=true]:border-brand-core/30",
        "[&>span]:text-[8px] [&>span]:uppercase [&>span]:tracking-widest [&>span]:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
