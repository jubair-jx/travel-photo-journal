// A short, human label for a session from its User-Agent string. Order matters: Edge and Opera
// also say "Chrome", and Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

const firstMatch = (table: [RegExp, string][], text: string): string | undefined =>
  table.find(([pattern]) => pattern.test(text))?.[1];

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = firstMatch(BROWSERS, userAgent);
  const system = firstMatch(SYSTEMS, userAgent);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}
