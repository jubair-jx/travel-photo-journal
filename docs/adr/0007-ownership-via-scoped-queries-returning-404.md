# Ownership enforced in the query, returning 404

Every photo query includes the caller in its filter (`where: { id, userId }`), so a photo that belongs to someone else is simply not found and the API responds 404 rather than 403. This avoids a fetch-then-compare step that can be forgotten on a new route, and the API never confirms that another user's photo ID exists.

Each photos route has a test proving a second user cannot read, update or delete the first user's photo.
