# Docker and CI: walkthrough and review questions

Private study notes.

## Step by step

1. **API image** (`apps/api/Dockerfile`): three stages. `build` installs everything and compiles; `prod-deps` installs production dependencies only; `runtime` copies `node_modules`, `dist`, and the Prisma schema, migrations and config. Non-root user, healthcheck, fail-fast config.
2. **Web image** (`apps/web/Dockerfile`): build with Next's `standalone` output (turned on by an env flag so Vercel is unaffected), runtime copies the standalone server, static assets and `public/`.
3. **Compose**: postgres, mailpit (pinned), a one-shot `migrate` service, api, web. Dependencies use health and completion conditions. Secrets come from a git-ignored `.env`; compose refuses to start without them.
4. **Config fix found along the way**: empty env values are now treated as unset, so copying `.env.example` (which has `KEY=` lines) or passing unset variables through compose works.
5. **CI**: read-only token permissions, timeouts, the original verify job, and a second job that builds both images.

## Likely review questions

**1. Why multi-stage builds?**
The build stage needs the compiler and dev tools; the runtime does not. Separate stages keep them out of the final image, which is smaller and has less attack surface. Copying only manifests first also keeps the dependency layer cached until the lockfile changes.

**2. Why is the build context the repository root?**
It is an npm-workspaces monorepo: one lockfile at the root covers both apps, so the Dockerfile needs the root manifests. `.dockerignore` keeps `node_modules`, git history, env files and local notes out of the context.

**3. Why does the container run as non-root?**
If the process is ever compromised, it should not own the filesystem or be able to install things. The uploads directory is explicitly chowned to the `node` user.

**4. The migrate service failed the first time. What was wrong?**
I installed production dependencies with `--ignore-scripts` (to skip the root git-hooks script), which also skipped Prisma's install step that downloads its migration engine. At release time the non-root user tried to download it into a read-only directory and failed. Fix: explicitly run `npm rebuild argon2 @prisma/engines` at build time as root. The compose ordering did its job: the API never started against an unmigrated database.

**5. How do migrations run in production?**
`prisma migrate deploy` from the same image, before the new API version takes traffic, using the direct (non-pooled) connection. It only applies pending migrations, in order; it never resets anything. In compose it is the `migrate` service, which the API waits for.

**6. Why is the Prisma CLI in production dependencies?**
Because the image has to run `migrate deploy` itself. The cost is image size (about 190 MB of Prisma tooling); a dedicated migrate image would split that out.

**7. Why is `API_INTERNAL_URL` a build argument for the web image?**
Next resolves rewrites when it builds, so the destination is baked into the routes manifest. Changing it later needs a rebuild, which is why the deployment guide says to set it before the build.

**8. Why are the compose secrets required rather than defaulted?**
A default secret in a committed file tends to survive into production. Failing at `compose up` with a clear message is safer, and generating the values is one command each.

**9. What does the CI image job add over the verify job?**
Tests and builds can pass while a Dockerfile is broken (a missing file, a changed lockfile). Building the images on every change catches that in the PR, not at deploy time.

**10. What are `permissions: contents: read` and the timeouts for?**
Least privilege: the workflow's token cannot write to the repository even if a step is compromised. Timeouts stop a hung job from burning minutes.

**11. Why did copying `.env.example` break the app before the fix?**
Optional settings were validated as "non-empty string if present", and a `KEY=` line is present-but-empty. Treating empty as unset matches how everyone writes `.env` files. A test covers it, and required settings that are empty are still reported as missing.

**12. How did you verify the containers, not just the build?**
I ran the whole compose stack from an empty database volume and drove the real flow through the web proxy: health, register, the email in the Mailpit container, verify, login, upload, signed image link, delete (file removed from the volume), and confirmed both app containers run as `node`.
