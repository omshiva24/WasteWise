// CSV export of requests (opens cleanly in Excel / Google Sheets).

import { WASTE_BY_ID } from './constants.js';

const cell = (v) => {
  let s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const iso = (t) => (t ? new Date(t).toISOString() : '');

export function requestsToCsv(requests) {
  const head = ['Code', 'Status', 'Waste type', 'Bin ID', 'Location', 'Zone', 'Priority', 'Raised by', 'Raised at', 'Vendor', 'Accepted at', 'Completed at', 'Weight (kg)', 'Rating', 'Notes'];
  const rows = requests.map((r) => [
    r.code, r.status, WASTE_BY_ID[r.wasteType]?.label || r.wasteType, r.binId, r.location, r.zone, r.priority,
    r.createdByName, iso(r.createdAt), r.vendorName, iso(r.acceptedAt), iso(r.completedAt), r.weightKg, r.rating, r.notes,
  ]);
  return '﻿' + [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
