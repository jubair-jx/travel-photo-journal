// Joins class names, skipping anything falsy: cn("a", cond && "b") -> "a b" or "a".
export const cn = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(" ");
