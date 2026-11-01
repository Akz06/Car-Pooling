import type { Car, Gender, Trip } from './types.ts';
import type { Crypto, Store, UserRecord } from './core.ts';

/** Demo community so the app is alive on first launch. Password for all: demo123 */
export function seed(db: Store, c: Crypto) {
  if (db.data.users.length) return false;
  const now = Date.now();
  const iso = (hours: number) => new Date(Math.ceil((now + hours * 3600_000) / 900_000) * 900_000).toISOString();
  const rid = c.id;

  const people: [string, string, Gender, number][] = [
    ['Priya Sharma', 'priya@demo.in', 'F', 4.9],
    ['Arjun Mehta', 'arjun@demo.in', 'M', 4.8],
    ['Kavya Nair', 'kavya@demo.in', 'F', 5.0],
    ['Rohan Gupta', 'rohan@demo.in', 'M', 4.7],
    ['Ananya Iyer', 'ananya@demo.in', 'F', 4.9],
    ['Vikram Singh', 'vikram@demo.in', 'M', 4.6],
    ['Meera Pillai', 'meera@demo.in', 'F', 4.8],
    ['Karthik Rao', 'karthik@demo.in', 'M', 4.9],
  ];
  const users: UserRecord[] = people.map(([name, email, gender, rating]) => {
    const { hash, salt } = c.hash('demo123');
    return { id: rid('usr'), name, email, gender, rating, passwordHash: hash, salt, createdAt: new Date().toISOString() };
  });
  const [priya, arjun, kavya, rohan, ananya, vikram, meera, karthik] = users;

  const car = (owner: UserRecord, modelId: string, paintId: string, interiorId: string, plate: string, year: number, nickname?: string): Car => ({
    id: rid('car'), ownerId: owner.id, modelId, paintId, interiorId, plate, year, nickname, createdAt: new Date().toISOString(),
  });
  const cars = [
    car(arjun, 'mahindra-xuv700', 'electric-blue', 'black-ivory', 'KA 03 MX 7007', 2024, 'Blue Thunder'),
    car(priya, 'hyundai-creta', 'atlas-white', 'black-greige', 'KA 01 HC 2411', 2024),
    car(vikram, 'toyota-innova-crysta', 'avant-garde-bronze', 'camel-tan', 'KA 05 TC 9090', 2022, 'The Family Bus'),
    car(kavya, 'tesla-model-y', 'pearl-white', 'black-white', 'KA 51 EV 0001', 2025),
    car(karthik, 'maruti-swift', 'novel-orange', 'black-silver', 'KA 02 MS 4455', 2024),
    car(meera, 'kia-carens', 'imperial-blue', 'indigo-beige', 'KA 04 KC 6262', 2023),
    car(rohan, 'honda-city', 'obsidian-blue', 'black-beige', 'KA 53 HN 1212', 2023),
  ];
  const [xuv, creta, innova, tesla, swift, carens, city] = cars;

  const book = (u: UserRecord, seatId: string) => ({ seatId, userId: u.id, name: u.name, gender: u.gender, bookedAt: new Date().toISOString() });
  const trip = (c: Car, from: string, to: string, inHours: number, price: number, offered: string[], bookings: Trip['bookings'], extra: Partial<Trip> = {}): Trip => ({
    id: rid('trp'), ownerId: c.ownerId, carId: c.id, from, to, departAt: iso(inHours), pricePerSeat: price,
    offeredSeats: offered, bookings, womenOnly: false, status: 'open', createdAt: new Date().toISOString(), ...extra,
  });

  const trips: Trip[] = [
    trip(xuv, 'Bengaluru, Indiranagar', 'Mysuru, Palace Road', 20, 450, ['1L', '2L', '2M', '2R', '3L', '3R'],
      [book(priya, '1L'), book(rohan, '2L'), book(ananya, '2R')], { notes: 'Breakfast stop at Kamat Lokaruchi. AC on, no smoking.' }),
    trip(creta, 'Bengaluru, Koramangala', 'Electronic City Phase 1', 14, 120, ['1L', '2L', '2R'],
      [book(kavya, '2L')], { womenOnly: true, notes: 'Daily office commute, middle seat kept free for comfort.' }),
    trip(innova, 'Bengaluru Airport (KIA T2)', 'Whitefield, ITPL', 6, 350, ['1L', '2L', '2R', '3L', '3M', '3R'],
      [book(meera, '2L'), book(karthik, '2R'), book(arjun, '3L')], { notes: 'Big boot — 4 suitcases OK.' }),
    trip(tesla, 'Bengaluru, HSR Layout', 'Chennai, T. Nagar', 44, 1400, ['1L', '2L', '2R'],
      [book(meera, '1L')], { notes: 'EV road trip, one Supercharger stop at Krishnagiri.' }),
    trip(swift, 'Bengaluru, Jayanagar', 'Nandi Hills', 30, 250, ['1L', '2L', '2M', '2R'],
      [book(vikram, '2L'), book(priya, '2M'), book(rohan, '2R')], { notes: 'Sunrise run — leaving 4:30 AM sharp!' }),
    trip(carens, 'Bengaluru, Hebbal', 'Coorg, Madikeri', 68, 900, ['1L', '2L', '2R', '3L', '3R'],
      [book(ananya, '2L')], { notes: 'Weekend getaway. Captain seats are super comfy.' }),
    trip(city, 'Bengaluru, Marathahalli', 'Hosur, SIPCOT', 26, 200, ['1L', '2L', '2R'], []),
  ];

  db.write((d) => {
    d.users.push(...users);
    d.cars.push(...cars);
    d.trips.push(...trips);
  });
  return true;
}
