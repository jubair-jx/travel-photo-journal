# Summary generation with fallback, never blocking the save

When a photo is created, or its description changes, the server asks OpenRouter to condense the description into a short summary. The key and model names are server-side configuration. A primary free model is tried first, then a configured fallback list, all within one 8-second overall deadline so added request latency is bounded.

If every attempt fails, the photo still saves with `summary` null and the failure is logged without the description text. On update, a failed regeneration also sets the summary to null rather than keeping one that describes the old text.

The call is synchronous to keep the feature simple and the response complete. Trade-off: create and edit requests can take up to the deadline longer when the provider is slow; a background queue would remove that and is a listed future improvement. Clients can never send a summary: it is stripped from every input schema.
