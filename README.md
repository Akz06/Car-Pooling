# SeatShare — car pooling where you see the real car

**Live app:** hosted on Railway (auto-deploys from `main`).

Owners add the car they actually drive (exact model, factory paint, interior trim, number plate, optional photo) and publish trips.
Riders — including other owners — browse open trips, look **inside the car**, see which seats are taken by a man ♂ (blue) or a woman ♀ (pink), and pick a free seat.

## Highlights

- **3D showroom** — every car is built in 3D from its real length, width, height and wheelbase: clear-coat factory paint, tinted glass, alloys, working lamps, Indian number plates, opening doors, and a roof that lifts off to show the real seat layout with passengers (♂ blue / ♀ pink). Orbit, zoom, front/side/rear/top cameras, day/night, in a white exhibition studio with reflective floor (scene approach adapted from [3d-car-viewing](https://github.com/jiaxiantao/3d-car-viewing), see `ATTRIBUTION.md`). Tap a seat in 3D to book it; the to-scale 2D **Seat map** is one tap away.
- **30 Indian-market cars** — Maruti (Swift, Baleno, Dzire, WagonR, Brezza, Fronx, Ertiga), Hyundai (i20, Venue, Creta, Verna), Tata (Punch, Nexon, Harrier, Safari), Mahindra (XUV 3XO, XUV700, Thar, Scorpio-N), Kia (Sonet, Seltos, Carens), Toyota (Hyryder, Innova Crysta, Innova Hycross, Fortuner), Honda (Amaze, City), MG Hector and Tesla Model Y.
- **Drop-in real 3D models** — put `client/public/models/cars/<model-id>.glb` and it replaces the built car automatically (see the README in that folder).

- **Model-accurate cars, drawn to scale** — every model uses its actual length/width/wheelbase, body style, seat layout (5-seat, 2+3+2, 2+2 captain+3, 2+2+2), factory paint names (incl. dual-tone roofs, metallic/pearl/matte finishes) and interior trims.
- **Real interiors** — each car gets its own dashboard (floating / integrated / panoramic dual-screen / Tesla 15.4"), analog or digital cluster, manual or auto shifter, captain-seat armrests, door cards, speakers, boot, and right-hand-drive steering wheel.
- **Car stage** — lift the roof (cabin ↔ exterior with sunroof / panoramic / glass roof and roof rails), day/night with headlamps and ambient lighting colours, 3D tilt, and doors that swing open when you hover a seat.
- **Gender-aware seat booking** — occupied seats show a person (blue ♂ / pink ♀); hovering a seat tells you who you'd sit next to. Women drivers can publish **women-only** rides.
- **Owner controls** — choose which seats to offer by tapping them on the car (e.g. keep the middle seat free), set price, notes, cancel trips.
- **Real photos** — each model's exterior and interior photos are looked up live from Wikipedia / Wikimedia Commons (freely licensed) and shown with author and licence credit, alongside the owner's own photo if uploaded. Results are cached in the browser; if Wikipedia can't be reached, the app keeps the to-scale drawing.
- **Mobile-first** — bottom tab bar, nose-up car with large tap targets, sticky "Book seat" bar, horizontally scrolling filters.
- Indian HSRP-style number plates, ₹ pricing.

## Run it

```bash
npm install
npm run dev        # API on :4000, web on http://localhost:5173
```

`npm run dev` loads sample users and trips (`priya@demo.in` … password `demo123`). Deployed servers start clean and remove that sample data; set `SEED_DEMO=1` to keep it.

Production:

```bash
npm run build && npm start   # serves the built app + API on :4000
```

Other scripts: `npm test` (API tests), `npm run typecheck`.

### Hosting with a real server (recommended)

Running the server gives everyone the same live trips and seats, and serves car photos from its own cache.

**Render (one click):** [Deploy to Render](https://render.com/deploy?repo=https://github.com/Akz06/Car-Pooling) — uses `render.yaml`:
Starter plan (always on), Singapore region, 1 GB disk at `/var/data` for accounts, bookings and the photo cache,
health check `/api/health`, auto-deploy on every push to `main`.

**Railway:** deploys from `railway.json` + `Dockerfile`. Add a PostgreSQL database in the same project and give the
app service the variable `DATABASE_URL = ${{Postgres.DATABASE_URL}}`; accounts, cars, trips and bookings are then stored
in Postgres (table `seatshare_state`). Generate a domain under the service's *Settings → Networking*.

**Anywhere else:** the `Dockerfile` runs on Fly.io or a VPS. Set `DATABASE_URL`, or mount a volume at `/data` for the JSON-file store.

Server features in production: gzip, year-long caching of hashed assets, `/api/img` same-origin photo cache
(Wikimedia, CarDekho), clean URLs (no `#/`).

### Preview on your phone

- **Same Wi-Fi:** `npm run dev -- --host`, then open the `Network:` URL Vite prints (e.g. `http://192.168.1.20:5173`) on your phone.
- **No server at all:** `npm run build:demo` produces `dist-demo/`, a self-contained build where the backend rules (`shared/core.ts`) run in the browser and data is kept in localStorage. Host it on any static host (GitHub Pages, Netlify, an artifact page). Real Wikimedia photos still load wherever outside images are allowed.

## Structure

```
shared/catalog.ts        real car catalogue: dimensions, seat rows, paints, trims, cabin features
shared/core.ts           all booking rules (used by the server and the in-browser demo)
shared/seed.ts           demo users, cars and trips
shared/types.ts          API types
server/app.ts            Express routes over shared/core.ts
server/db.ts             JSON-file store (data/db.json, atomic writes)
client/src/lib/carGeometry.ts   turns mm dimensions into a top-down drawing plan
client/src/components/CarView.tsx  the SVG car renderer (body, glass, cabin, seats, occupants)
client/src/lib/carPhotos.ts     live Wikimedia photo lookup (generation hints per model in catalog `wiki`)
client/src/three/               3D showroom: carBuilder.ts (dimensions → body), Car3D.tsx, Scene3D.tsx
client/src/components/CarStage.tsx 3D / seat-map stage with roof, day/night and camera controls
client/src/pages/*       Find a ride, trip & seat picker, garage, add-car configurator, offer a ride, my trips, showroom
```

## Password reset (WhatsApp via Zoho CPaaS)

Users add a mobile number at sign-up or on the **Account** page. **Forgot password?** sends a 6-digit code to WhatsApp
(10-minute expiry, 5 tries, 3 codes per 15 minutes; codes are stored hashed). Set these variables on the server:

| Variable | Value |
|---|---|
| `ZOHO_CPAAS_API_KEY` | Send API key of your Zoho CPaaS Agent (Agent → WhatsApp → API) |
| `ZOHO_WHATSAPP_FROM` | Your WhatsApp Business number, e.g. `+919876543210` |
| `ZOHO_WHATSAPP_TEMPLATE` | Template key of an approved **Authentication** template |
| `ZOHO_WHATSAPP_CODE_FIELD` | The template's code variable name (default `otp`) |
| `ZOHO_CPAAS_URL` | Optional; default `https://cpaas.zoho.com/v1.1/whatsapp` |

Until they're set (or if a send fails), the code is written to the server log. The owner can also force a reset with
`RESET_EMAIL` + `RESET_PASSWORD` (remove them after one deploy).

## Booking rules (server-enforced)

- The driver seat (1R, right-hand drive) always belongs to the trip owner; owners can't book their own trip.
- Only seats the owner offered can be booked; one seat per rider per trip; first come, first served.
- Women-only trips accept only female riders and can only be published by women.
- Trip status (open / full / departed / cancelled) is derived from bookings and departure time.
