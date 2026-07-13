// ponytail: CSV opens in Excel — no xlsx dependency needed.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const cols = [
  'id', 'name', 'city', 'country', 'jciAccredited', 'fairnessScore', 'overallRating',
  'quotedPriceUsd', 'localPriceUsd', 'localBenchmarkUsd', 'mysteryShopperScore',
  'patientsPerYear', 'internationalPercent', 'specialty', 'intlOfficePhone',
  'intlOfficeEmail', 'website', 'address', 'createdAt',
];

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

(async () => {
  const rows = await prisma.hospital.findMany({ orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }] });
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n');
  fs.writeFileSync('../hospitals.csv', '﻿' + csv); // BOM so Excel reads UTF-8
  console.log(`Exported ${rows.length} hospitals -> hospitals.csv`);
  await prisma.$disconnect();
})();
