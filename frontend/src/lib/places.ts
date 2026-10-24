// Place suggestions for the location field, from the public Photon geocoder (OpenStreetMap data).
// It is a convenience only: the field accepts any text, and a failed lookup falls back to typing.
const ENDPOINT = "https://photon.komoot.io/api/";
const LAYERS = ["city", "locality", "district", "county", "state", "country"];

interface PhotonProperties {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface PhotonResponse {
  features?: { properties?: PhotonProperties }[];
}

// "Cox's Bazar, Chattogram Division, Bangladesh": the place, then where it is, without repeats.
export function formatPlace({ name, city, state, country }: PhotonProperties): string | undefined {
  const parts = [name, city, state, country].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<string[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  // Geographic places only; this skips shops, stations and other points of interest.
  for (const layer of LAYERS) url.searchParams.append("layer", layer);

  const response = await fetch(url, { signal });
  // Throws on 429 or any other failure, so the field can tell "no matches" from "unavailable".
  if (!response.ok) throw new Error(`Place search failed with status ${response.status}`);
  const body = (await response.json()) as PhotonResponse;

  const labels = (body.features ?? []).flatMap((feature) => {
    const label = feature.properties ? formatPlace(feature.properties) : undefined;
    return label ? [label] : [];
  });
  return [...new Set(labels)];
}
