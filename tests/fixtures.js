// Deterministic sample requests for unit tests only (the app itself has no sample data).
import { WASTE_TYPES, DAY } from '../public/js/core/constants.js';

export function sampleRequests(now, n = 70) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const places = ['Library Block - Entrance', 'Hostel Mess', 'Science Block', 'Main Gate', 'Sports Complex', 'Admin Building'];
  return Array.from({ length: n }, (_, i) => {
    const created = now - Math.floor(rnd() * 120 * DAY);
    const roll = rnd();
    const status = roll < 0.65 ? 'COMPLETED' : roll < 0.8 ? 'ACCEPTED' : roll < 0.95 ? 'OPEN' : 'CANCELLED';
    const accepted = status === 'OPEN' || status === 'CANCELLED' ? null : created + Math.floor(rnd() * 2 * DAY);
    const completed = status === 'COMPLETED' ? accepted + Math.floor(rnd() * 3 * DAY) : null;
    return {
      id: `r${i}`,
      code: `WR-${1001 + i}`,
      wasteType: WASTE_TYPES[i % WASTE_TYPES.length].id,
      binId: `BIN-${String.fromCharCode(65 + (i % 5))}0${(i % 9) + 1}`,
      location: places[i % places.length],
      zone: `Zone ${(i % 4) + 1}`,
      priority: rnd() < 0.2 ? 'urgent' : 'normal',
      status,
      createdBy: `sup${i % 3}`,
      createdByName: ['Kavya Raman', 'Arjun Mehta', 'Divya Iyer'][i % 3],
      createdAt: created,
      acceptedAt: accepted,
      completedAt: completed,
      vendorId: accepted ? `ven${i % 2}` : null,
      vendorName: accepted ? ['GreenCycle', 'EcoHaul'][i % 2] : null,
      weightKg: completed ? Math.round(20 + rnd() * 180) : null,
      rating: completed ? 3 + Math.floor(rnd() * 3) : null,
      history: [],
    };
  });
}
