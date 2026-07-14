# Free hosting walkthrough

Three services, three free hosts. Everything the code needs (`render.yaml`,
`frontend/vercel.json`, `PORT`/`FRONTEND_URL`/`VITE_API_URL` wiring) is already
in place — this is the account-and-click part I can't do for you.

**Fixed, not just disclosed:** the two real correctness gaps in the free-tier
path — uploads not surviving a redeploy, and reminders not firing while the
free backend sleeps — are now handled in code (steps 3a and 3b below turn
them on). Skip either step and the app still works, just with the original
limitation.

**Remaining tradeoffs** (inherent to the free tiers, not fixed in code):
- Render's free web service sleeps after 15 min idle. First request after
  sleeping takes 30–50s. (The cron pings in step 3.6 don't prevent this —
  they're sparse, ~4/day — they just guarantee the reminders themselves run.)
- Clever Cloud's free MySQL plan caps around 10MB storage — fine for a demo,
  not for real transaction volume.

---

## 1. Push the code to GitHub

The repo is already initialized and committed locally. Create an empty repo at
[github.com/new](https://github.com/new) (no README/gitignore/license — it's
empty), then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 2. Database — Clever Cloud (free MySQL)

1. Sign up at [clever-cloud.com](https://www.clever-cloud.com) (GitHub login works).
2. Create an add-on → **MySQL** → pick the **DEV** (free) plan.
3. Once provisioned, open it and copy: host, port, database name, user, password.

## 3. Backend — Render

1. Sign up at [render.com](https://render.com) (GitHub login works) and
   authorize it to see your new repo.
2. **New → Blueprint**, pick the repo. Render reads `render.yaml`
   automatically and proposes the `insurance-crm-api` service.
3. Before the first deploy, open the service's **Environment** tab and add:

   | Key | Value |
   |---|---|
   | `DB_HOST` | from Clever Cloud |
   | `DB_PORT` | from Clever Cloud |
   | `DB_NAME` | from Clever Cloud |
   | `DB_USER` | from Clever Cloud |
   | `DB_PASSWORD` | from Clever Cloud |
   | `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` locally, paste the output |
   | `ENCRYPTION_KEY` | run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` locally, paste the output |
   | `TRUST_PROXY` | `1` |
   | `FRONTEND_URL` | placeholder for now, e.g. `https://placeholder.vercel.app` — you'll fix this in step 5 |

4. Deploy. Render runs `npm ci && npm run migrate` then starts the server —
   watch the logs; migrations create the whole schema on the empty database.
5. Once live, copy the service URL (`https://insurance-crm-api-xxxx.onrender.com`).
   Confirm it works: `https://<that-url>/api/health` should return JSON.

### 3a. Durable uploads — Cloudinary (free, recommended)

Without this, a contact-import file uploaded right before Render redeploys
(or wakes from sleep) can vanish before you finish mapping columns and hit
"import" — Render's disk doesn't survive restarts. With it, the file goes to
Cloudinary instead and survives indefinitely.

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25GB, no
   expiry, no card required).
2. On your Cloudinary dashboard home page, copy the **API Environment
   variable** — it looks like `cloudinary://123456789:AbCdEf...@your-cloud-name`.
3. In Render → Environment, add `CLOUDINARY_URL` = that value, save (redeploys
   automatically).

Skip this and imports still work — you just need to finish "upload → map →
import" in one sitting, before any redeploy or sleep/wake cycle happens.

### 3b. Reliable reminders — cron-job.org (free, recommended)

The renewal/birthday/follow-up reminders run on an internal schedule
(`node-cron`), but Render suspends the whole process when nobody's visiting
the site — so they silently don't fire while asleep. This step adds an
external trigger that fires regardless of sleep state, using a secret the app
already checks for (`CRON_SECRET`) rather than a login.

1. In Render → Environment, add `CRON_SECRET`. Generate one locally:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Save (redeploys automatically).
2. Sign up at [cron-job.org](https://cron-job.org) (free, no card).
3. Create **four** cron jobs, each a `POST` request with the header
   `X-Cron-Secret: <the value you just generated>`:

   | Job | Schedule | URL |
   |---|---|---|
   | Renewal reminders | daily, 09:00 | `https://<your-render-url>/api/cron/run/renewal-reminders` |
   | Follow-up digest | daily, 08:30 | `https://<your-render-url>/api/cron/run/followup-digest` |
   | Birthday wishes | daily, 09:00 | `https://<your-render-url>/api/cron/run/birthday-wishes` |
   | Weekly summary | Mondays, 10:00 | `https://<your-render-url>/api/cron/run/weekly-summary` |

   (Times are in whatever timezone you configure for the job on cron-job.org —
   the app's schedule is naive and just runs when pinged.)

Skip this and reminders only fire on the rare occasion Render happens to
already be awake at 9am/8:30am/etc. — most days, nothing sends.

## 4. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) (GitHub login works).
2. **Add New → Project**, pick the repo.
3. Set **Root Directory** to `frontend` (Vercel auto-detects Vite from there).
4. Add an environment variable: `VITE_API_URL` = `https://<your-render-url>/api`
   (the URL you copied in step 3, point 5, with `/api` on the end).
5. Deploy. Copy the resulting URL (`https://your-app.vercel.app`).

## 5. Close the loop

Go back to Render → Environment → update `FRONTEND_URL` to your real Vercel
URL from step 4.5, and save (this redeploys automatically). CORS won't allow
the frontend to talk to the backend until this matches.

## 6. Log in

Visit your Vercel URL. Default admin: `admin@insurancecrm.com` / `Admin@123`
— **change this password immediately**, it's a fresh public URL.

---

## Updating after this

Every `git push` to `main` auto-redeploys both Vercel and Render. Render
re-runs `npm run migrate` on every deploy, so new migrations apply themselves.
