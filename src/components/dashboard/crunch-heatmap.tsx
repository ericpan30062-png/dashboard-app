import { TriangleAlert } from "lucide-react";
import {
  intensityToColor,
  intensityTextIsLight,
  type DayLoad,
} from "@/lib/crunch-predictor";
import type { DangerWindow } from "@/lib/crunch-summary";

// Sampled at a fine enough step that the CSS linear-gradient reads as
// smooth rather than banded.
const GRADIENT_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function formatCellDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    day: d,
  };
}

function formatRangeLabel(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return startDate === endDate ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function CrunchHeatmap({
  days,
  dangerWindows,
}: {
  days: DayLoad[];
  dangerWindows: DangerWindow[] | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Load, by due-soon grade weight</span>
          <div
            className="h-2 w-48 rounded-full"
            style={{
              background: `linear-gradient(to right, ${GRADIENT_STOPS.map(
                (pct) => intensityToColor(pct),
              ).join(", ")})`,
            }}
          />
          <div className="flex w-48 justify-between text-[10px] text-zinc-500">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const { weekday, day: dayNum } = formatCellDate(day.date);
            const light = intensityTextIsLight(day.intensity);
            const tooltip = [
              day.date,
              `Load score: ${day.rawScore.toFixed(0)}`,
              `Due-soon grade weight: ${day.dueWeightSum}%`,
              `Calendar events: ${day.eventCount}`,
              `Est. hours needed: ${day.hoursNeededSum.toFixed(1)}`,
              day.dueSoonAssignments.length > 0
                ? `Due soon: ${day.dueSoonAssignments.map((a) => a.name).join(", ")}`
                : "Nothing due soon",
            ].join("\n");

            return (
              <div
                key={day.date}
                title={tooltip}
                className="flex aspect-square flex-col items-center justify-center rounded-lg text-xs"
                style={{
                  background: intensityToColor(day.intensity),
                  color: light ? "white" : "#27272a",
                }}
              >
                <span className="opacity-70">{weekday}</span>
                <span className="font-semibold">{dayNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Danger windows
        </h3>
        {dangerWindows && dangerWindows.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {dangerWindows.map((window, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
              >
                <TriangleAlert
                  className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                  strokeWidth={1.75}
                />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                    {window.title}{" "}
                    <span className="font-normal text-red-700 dark:text-red-400">
                      ({formatRangeLabel(window.startDate, window.endDate)})
                    </span>
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-300">{window.reason}</p>
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    Start early: {window.recommendation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            No major danger windows detected in the next 30 days.
          </p>
        )}
      </div>
    </div>
  );
}
