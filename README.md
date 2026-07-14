# Invic Business Corp LLP - Insurance CRM

A complete, production-ready Customer Relationship Management web application designed specifically for insurance agencies. Built with React (Vite + Ant Design) on the frontend and Node.js (Express + Sequelize + MySQL) on the backend.

## Prerequisites

- **Node.js**: v20 or higher
- **MySQL**: v8 or higher
- **npm**: v10 or higher (comes with Node.js)

## Installation & Setup

1. **Clone the repository (or navigate to the project folder)**
   ```bash
   cd insurance-crm
   ```

2. **Create the MySQL Database**
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS insurance_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```
   *The schema itself is created by migrations in step 5 — do **not** run `database/schema.sql`, which is retained only as a historical reference and covers just 8 of the 27 tables.*

3. **Configure the Backend**
   ```bash
   cd backend
   cp .env.example .env
   ```
   Open `backend/.env` and set the database password, Gmail credentials, and WATI credentials. Two values are **required** — the server refuses to start without them:
   ```bash
   # JWT_SECRET (min 32 chars)
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   # ENCRYPTION_KEY (exactly 32 bytes as hex) — encrypts PAN/Aadhaar and API credentials
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   ⚠️ Changing `ENCRYPTION_KEY` later makes existing encrypted values unreadable. Set it once, back it up, and treat it like a database password.

4. **Install Backend Dependencies**
   ```bash
   npm install
   ```

5. **Run Migrations**
   ```bash
   npm run migrate
   ```
   This creates every table, adds indexes, and seeds the default organization. Re-run it after any `git pull`.

6. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

7. **Start the Application**
   Open two terminal windows:
   
   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm run dev
   ```
   
   **Terminal 2 (Frontend):**
   ```bash
   cd frontend
   npm run dev
   ```

8. **Access the CRM**
   Open your browser and navigate to: `http://localhost:5173`
   
   **Default Admin Login:**
   - Email: `admin@insurancecrm.com`
   - Password: `Admin@123`
   
   ⚠️ Change this password immediately on any deployment that isn't your laptop.

---

## Database Migrations

The schema is owned by migrations in `backend/migrations/`. The app no longer
calls `sequelize.sync()` at boot — it previously re-added a duplicate UNIQUE
index to `users.email` on every start (8 had accumulated against MySQL's
64-key-per-table limit before it was caught).

```bash
npm run migrate           # apply pending migrations
npm run migrate:pending   # list what hasn't run
npm run migrate:executed  # list what has
npm run migrate:down      # roll back the most recent one
```

Every migration implements both `up()` and `down()`. The server warns at boot
if migrations are pending, and `/api/ready` reports them.

To add one, create `backend/migrations/00N-name.migration.js` exporting `up`
and `down`, both taking Sequelize's `queryInterface`.

---

## Testing

```bash
cd backend
npm run migrate
RATE_LIMIT_AUTH_MAX=500 npm run dev   # in one terminal
npm test                              # in another
```

155 integration tests run against a live server and a real database. The
`RATE_LIMIT_AUTH_MAX` override is needed because the suite logs in far more
often than a human would and would otherwise trip the auth rate limiter
(default: 30 POSTs per 15 minutes per IP).

CI (`.github/workflows/ci.yml`) runs migrations, verifies they roll back, boots
the server, checks readiness, and runs the suite against MySQL 8.

---

## Environment Variables Reference

`backend/.env` must contain the following variables:

| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `PORT` | Backend server port | `5000` |
| `DB_HOST` | MySQL database host | `localhost` |
| `DB_PORT` | MySQL database port | `3306` |
| `DB_NAME` | MySQL database name | `insurance_crm` |
| `DB_USER` | MySQL database user | `root` |
| `DB_PASSWORD` | MySQL database password | `your_mysql_password` |
| `JWT_SECRET` | **Required.** Signs JWTs. Server refuses to start if missing or under 32 chars. | `min_32_chars_long_key` |
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `ENCRYPTION_KEY` | **Required.** 32-byte hex key encrypting PAN/Aadhaar and provider credentials at rest. Rotating it orphans existing data. | `<64 hex chars>` |
| `TRUST_PROXY` | Reverse proxies in front of the app; makes rate limiting see real client IPs | `1` |
| `RATE_LIMIT_AUTH_MAX` | Max POSTs to `/api/auth` per IP per 15 min | `30` |
| `LOG_LEVEL` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` | `info` |
| `ERROR_TRACKING_DSN` | Optional. Error-tracking endpoint; logs locally when unset. | *(empty)* |
| `GMAIL_USER` | Gmail address for sending emails | `your@gmail.com` |
| `GMAIL_APP_PASSWORD`| Gmail App Password (not your account password) | `abcd efgh ijkl mnop` |
| `WATI_API_URL` | WATI API Base URL | `https://live-mt-server.wati.io/YOUR_INSTANCE` |
| `WATI_API_TOKEN` | WATI Bearer Token for API calls | `your_wati_bearer_token` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `NODE_ENV` | Environment | `development` or `production` |

---

## API Documentation

The API runs on `/api/`. All endpoints (except login/register and the public
webhook) require the `Authorization: Bearer <token>` header.

Every request is scoped to the caller's organization. Tokens carry a
`token_version` that is checked against the database on each request, so
deactivating a user or changing their role ends their session immediately
rather than when the token expires.

### Health (`/api`)
- `GET /health`: Liveness. Returns 200 whenever the process is up; does not touch the database.
- `GET /ready`: Readiness. Checks the database and reports pending migrations. Returns 503 when not serviceable — point your load balancer at this one.

### Notes (`/api/notes`)
- `GET /?lead_id=1` or `?customer_id=1`: Paginated notes with author.
- `POST /`: `{ lead_id | customer_id, body }` — exactly one subject.
- `PUT /:id`, `DELETE /:id`: Agents may only edit/delete their own notes.

### Auth (`/api/auth`)
- `POST /login`: `{ email, password }` → Returns JWT token and user info.
- `POST /register`: `{ name, email, mobile, password }`
- `GET /me`: Returns current logged-in user.

### Leads (`/api/leads`)
- `GET /`: List leads with pagination (`?page=1&limit=20`) and filters (`?status=New&source=Facebook`).
- `GET /pipeline`: Returns leads grouped by status for Kanban view.
- `GET /:id`: Lead details including follow-ups.
- `POST /`: Create a lead. Requires `name` and `mobile`.
- `POST /convert/:id`: Converts a lead to a Customer.

### Customers (`/api/customers`)
- `GET /`: List customers with pagination.
- `GET /:id`: Full customer details (includes policies, documents, followups).
- `POST /`: Create a new customer.
- `PUT /:id`: Update KYC/Profile details.

### Policies (`/api/policies`)
- `GET /`: List policies.
- `GET /renewals-due`: List policies due for renewal.
- `POST /`: Create a policy for a customer. Auto-calculates `next_due_date`.

### Follow-ups (`/api/followups`)
- `GET /`: List follow-ups (tasks).
- `GET /today`: List follow-ups scheduled for today and not done.
- `POST /`: Create a follow-up for a lead or customer.
- `PUT /:id/done`: Mark a follow-up as done with outcome notes.

### Renewals (`/api/renewals`)
- `GET /upcoming`: Get renewals due in next 30/60 days grouped by urgency.
- `GET /overdue`: Get past-due active policies.
- `POST /send-reminder/:policyId`: Triggers WhatsApp reminder via WATI API.

### Agents (`/api/agents`)
- `GET /`: List recruited agents/candidates.
- `POST /`: Add a candidate.

### Reports (`/api/reports`) - *Admin/Manager only*
- `GET /dashboard`: Top level KPIs.
- `GET /sales-summary`: Lead conversion summary by date range.
- `GET /monthly-trend`: Last 12 months data.

---

## Deployment to Production

1. **Prepare Server**
   - Provision a Linux VPS (Ubuntu 22.04 recommended).
   - Install Node.js 20, MySQL 8, Nginx, and PM2.

2. **Database Setup**
   - Create an empty `insurance_crm` database on the production MySQL server.
   - Do not import `database/schema.sql`; migrations own the schema.

3. **Backend Deployment**
   ```bash
   cd backend
   npm ci --omit=dev
   npm run migrate            # apply schema changes before starting
   pm2 start server.js --name "insurance-crm-api"
   pm2 save
   pm2 startup
   ```
   Run `npm run migrate` as a deploy step on every release. The server only
   warns about pending migrations — it won't apply them, and it won't refuse to
   boot, because turning a schema drift into an outage helps nobody.

4. **Frontend Deployment**
   ```bash
   cd frontend
   npm run build
   ```
   This generates a `dist/` folder.
   
5. **Nginx Configuration**
   Create an Nginx server block:
   ```nginx
   server {
       listen 80;
       server_name crm.yourdomain.com;

       # Serve React Frontend
       location / {
           root /path/to/insurance-crm/frontend/dist;
           try_files $uri $uri/ /index.html;
       }

       # Proxy API requests to Node Backend
       location /api/ {
           proxy_pass http://localhost:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       # Serve Uploaded Documents
       location /uploads/ {
           alias /path/to/insurance-crm/backend/uploads/;
       }
   }
   ```

---

## WhatsApp Setup Guide (WATI)

1. Sign up for a [WATI](https://www.wati.io/) account.
2. In the WATI dashboard, navigate to **API Docs**.
3. Copy your **API Endpoint** and **Bearer Token**.
4. Paste these into your `backend/.env` file as `WATI_API_URL` and `WATI_API_TOKEN`.
5. Create Broadcast Templates in WATI for:
   - Renewal Reminder
   - Follow-up Reminder
   - Welcome Message
   - Birthday Wish
6. Ensure the template names/variables match the payload in `backend/services/whatsappService.js`.
