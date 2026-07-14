# Free hosting walkthrough

Three services, three free hosts. Everything the code needs (`render.yaml`,
`frontend/vercel.json`, `PORT`/`FRONTEND_URL`/`VITE_API_URL` wiring) is already
in place — this is the account-and-click part I can't do for you.

**Known limits of this path** (all free tiers have tradeoffs):
- Render's free web service sleeps after 15 min idle. First request after
  sleeping takes 30–50s. The cron reminders (renewals, birthdays, follow-up
  digest) won't fire while it's asleep.
- Render's free disk is ephemeral — anything in `backend/uploads/` (imported
  contact files, uploaded documents) is wiped on every redeploy/restart.
- Clever Cloud's free MySQL plan caps around 10MB storage — fine for a demo,
  not for real transaction volume.

If any of those are dealbreakers later, tell me — I can wire in free object
storage for uploads (Cloudinary) or move the cron jobs to a scheduled job
service instead of in-process `node-cron`.

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

## 4. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) (GitHub login works).
2. **Add New → Project**, pick the repo.
3. Set **Root Directory** to `frontend` (Vercel auto-detects Vite from there).
4. Add an environment variable: `VITE_API_URL` = `https://<your-render-url>/api`
   (the URL from step 3.5, with `/api` on the end).
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
