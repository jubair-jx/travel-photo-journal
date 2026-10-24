import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 Edg/124.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      "Safari on iOS",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0", "Firefox on Linux"],
    ["curl/8.0", "Unknown device"],
  ])("labels %j", (agent, label) => {
    expect(describeDevice(agent)).toBe(label);
  });

  it("copes with a missing user agent", () => {
    expect(describeDevice(null)).toBe("Unknown device");
  });
});
