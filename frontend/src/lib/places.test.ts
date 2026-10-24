import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPlace, searchPlaces } from "./places";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatPlace", () => {
  it("joins the place with where it is", () => {
    expect(
      formatPlace({ name: "Cox's Bazar", state: "Chattogram Division", country: "Bangladesh" }),
    ).toBe("Cox's Bazar, Chattogram Division, Bangladesh");
  });

  it("does not repeat a name that is also the city or state", () => {
    expect(formatPlace({ name: "Paris", city: "Paris", country: "France" })).toBe("Paris, France");
  });

  it("returns nothing when there is nothing to show", () => {
    expect(formatPlace({})).toBeUndefined();
  });
});

describe("searchPlaces", () => {
  const respond = (body: unknown, ok = true) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }));

  it("returns unique readable labels", async () => {
    respond({
      features: [
        { properties: { name: "Kyoto", country: "Japan" } },
        { properties: { name: "Kyoto", country: "Japan" } },
        { properties: { name: "Kyoto", state: "Kyoto Prefecture", country: "Japan" } },
        {},
      ],
    });

    const labels = await searchPlaces("kyo", new AbortController().signal);

    expect(labels).toEqual(["Kyoto, Japan", "Kyoto, Kyoto Prefecture, Japan"]);
  });

  it("returns no suggestions when the service errors", async () => {
    respond({}, false);

    await expect(searchPlaces("kyo", new AbortController().signal)).resolves.toEqual([]);
  });
});
