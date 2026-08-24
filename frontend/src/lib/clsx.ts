// Tiny dependency-free clsx-like helper so we don't need to add the `clsx`
// package as an extra dependency just for conditional class names.
export type ClassValue = string | number | null | undefined | false | Record<string, boolean | undefined>;

export default function clsx(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
    } else if (typeof value === "object") {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}
