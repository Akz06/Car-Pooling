# SeatShare — car pooling where you see the real car

Owners add the car they actually drive (exact model, factory paint, interior trim, number plate, optional photo) and publish trips.
Riders — including other owners — browse open trips, look **inside the car**, see which seats are taken by a man ♂ (blue) or a woman ♀ (pink), and pick a free seat.

## Highlights

- **Model-accurate cars, drawn to scale** — 11 real cars (Maruti Swift & Ertiga, Hyundai Creta & Verna, Honda City, Tata Nexon, Mahindra XUV700, Toyota Innova Crysta & Fortuner, Kia Carens, Tesla Model Y) using their actual length/width/wheelbase, body style, seat layout (5-seat, 2+3+2, 2+2 captain+3, 2+2+2), factory paint names (incl. dual-tone roofs, metallic/pearl/matte finishes) and interior trims.
- **Real interiors** — each car gets its own dashboard (floating / integrated / panoramic dual-screen / Tesla 15.4"), analog or digital cluster, manual or auto shifter, captain-seat armrests, door cards, speakers, boot, and right-hand-drive steering wheel.
- **Car stage** — lift the roof (cabin ↔ exterior with sunroof / panoramic / glass roof and roof rails), day/night with headlamps and ambient lighting colours, 3D tilt, and doors that swing open when you hover a seat.
- **Gender-aware seat booking** — occupied seats show a person (blue ♂ / pink ♀); hovering a seat tells you who you'd sit next to. Women drivers can publish **women-only** rides.
- **Owner controls** — choose which seats to offer by tapping them on the car (e.g. keep the middle seat free), set price, notes, cancel trips.
- Indian HSRP-style number plates, ₹ pricing, mobile layout (nose-up car on phones).

## Run it

```bash
npm install
npm run dev        # API on :4000, web on http://localhost:5173
```

Demo data is seeded on first start — sign in as `priya@demo.in`, `arjun@demo.in`, `kavya@demo.in`, `vikram@demo.in` … (password `demo123`), or create your own account.

Production:

```bash
npm run build && npm start   # serves the built app + API on :4000
```

Other scripts: `npm test` (API tests), `npm run typecheck`.

## Structure

```
shared/catalog.ts        real car catalogue: dimensions, seat rows, paints, trims, cabin features
shared/types.ts          API types
server/app.ts            Express API (auth, cars, trips, seat booking rules)
server/db.ts             JSON-file store (data/db.json, atomic writes)
server/seed.ts           demo users, cars and trips
client/src/lib/carGeometry.ts   turns mm dimensions into a top-down drawing plan
client/src/components/CarView.tsx  the SVG car renderer (body, glass, cabin, seats, occupants)
client/src/components/CarStage.tsx parking-bay stage with roof / night / 3D / ambient controls
client/src/pages/*       Find a ride, trip & seat picker, garage, add-car configurator, offer a ride, my trips, showroom
```

## Booking rules (server-enforced)

- The driver seat (1R, right-hand drive) always belongs to the trip owner; owners can't book their own trip.
- Only seats the owner offered can be booked; one seat per rider per trip; first come, first served.
- Women-only trips accept only female riders and can only be published by women.
- Trip status (open / full / departed / cancelled) is derived from bookings and departure time.
