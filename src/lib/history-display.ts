/** Describe changes within one verified patient/unit group, without medical interpretation. */
export function describeChange(first: number, last: number, unit: string): string {
  const format = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 8 }).format(n);
  const delta = Number((last - first).toPrecision(12));
  const change = delta === 0 ? "no change" : `${delta < 0 ? "decreased" : "increased"} by ${format(Math.abs(delta))} ${unit}`;
  return `${format(first)} → ${format(last)} ${unit}: ${change}.`;
}
