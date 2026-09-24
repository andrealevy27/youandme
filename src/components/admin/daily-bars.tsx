/**
 * Dependency-free daily bar chart (inline SVG). One series, brand hue, thin bars with
 * 4px rounded tops anchored to the baseline and a 2px gap. Hover shows the exact value;
 * a visually hidden table carries the same data for screen readers.
 */
export function DailyBars({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  const W = 600;
  const H = 140;
  const padTop = 16;
  const padBottom = 22;
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = W / Math.max(1, data.length);
  const barW = Math.max(2, slot - 2);
  const plotH = H - padTop - padBottom;
  const total = data.reduce((a, d) => a + d.count, 0);
  const fmt = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" role="img" aria-label={`${label}: ${total} in the last ${data.length} days`} preserveAspectRatio="none">
        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--border)" strokeWidth={1} />
        <line x1={0} x2={W} y1={padTop} y2={padTop} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
        {data.map((d, i) => {
          const h = d.count === 0 ? 0 : Math.max(3, (d.count / max) * plotH);
          const x = i * slot + (slot - barW) / 2;
          const y = H - padBottom - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.day} className="group">
              <title>{`${fmt(d.day)}: ${d.count}`}</title>
              {/* Oversized hit target so hovering thin bars is easy. */}
              <rect x={i * slot} y={padTop} width={slot} height={plotH} fill="transparent" />
              <rect x={i * slot} y={padTop} width={slot} height={plotH} className="fill-transparent group-hover:fill-[var(--surface)]" />
              {h > 0 && (
                <path
                  d={`M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`}
                  fill="var(--brand)"
                />
              )}
            </g>
          );
        })}
        <text x={0} y={H - 6} fontSize={11} fill="var(--subtle)">
          {data[0] ? fmt(data[0].day) : ""}
        </text>
        <text x={W} y={H - 6} fontSize={11} fill="var(--subtle)" textAnchor="end">
          {data.at(-1) ? fmt(data.at(-1)!.day) : ""}
        </text>
        <text x={W} y={padTop - 4} fontSize={11} fill="var(--subtle)" textAnchor="end">
          {max}
        </text>
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
