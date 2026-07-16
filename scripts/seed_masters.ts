/**
 * Seed reference master data (specialties, qualifications, languages, timezones)
 * used by the doctor-profile dropdowns. Idempotent — safe to run on every deploy.
 *
 *   cd backend && npx ts-node scripts/seed_masters.ts
 *
 * Production: run this as part of your deploy/seed step so the dropdowns are populated.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPECIALTIES = [
  'Orthopedics', 'Cardiology', 'Cardiac Surgery', 'Oncology', 'Surgical Oncology', 'Neurology',
  'Neurosurgery', 'Fertility & IVF', 'Nephrology', 'Urology', 'Gastroenterology', 'Hepatology',
  'Ophthalmology', 'Dental', 'Cosmetic & Plastic Surgery', 'ENT', 'Bariatric Surgery',
  'Organ Transplant', 'Spine Surgery', 'Pediatrics', 'Dermatology', 'Pulmonology',
  'Endocrinology', 'Rheumatology', 'General Surgery', 'Vascular Surgery', 'Gynecology',
];

const QUALIFICATIONS = [
  'MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'MDS', 'BDS', 'MRCP', 'MRCS', 'FRCS', 'FRCP',
  'FACS', 'FICS', 'FACC', 'PhD', 'Fellowship', 'Diploma', 'DGO', 'DNB (Super-speciality)',
];

const LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali',
  'Gujarati', 'Punjabi', 'Urdu', 'Arabic', 'French', 'Spanish', 'Russian', 'Mandarin',
  'Portuguese', 'Swahili', 'German', 'Bahasa', 'Bengali (Bangla)', 'Amharic', 'Somali',
];

const TIMEZONES: [string, string][] = [
  ['Asia/Kolkata', 'India (IST)'],
  ['Asia/Dubai', 'UAE (GST)'],
  ['Asia/Riyadh', 'Saudi Arabia (AST)'],
  ['Asia/Qatar', 'Qatar (AST)'],
  ['Asia/Kuwait', 'Kuwait (AST)'],
  ['Asia/Muscat', 'Oman (GST)'],
  ['Asia/Dhaka', 'Bangladesh (BST)'],
  ['Asia/Kathmandu', 'Nepal (NPT)'],
  ['Asia/Colombo', 'Sri Lanka (IST)'],
  ['Asia/Singapore', 'Singapore (SGT)'],
  ['Africa/Lagos', 'Nigeria (WAT)'],
  ['Africa/Nairobi', 'Kenya (EAT)'],
  ['Africa/Cairo', 'Egypt (EET)'],
  ['Africa/Addis_Ababa', 'Ethiopia (EAT)'],
  ['Europe/London', 'UK (GMT/BST)'],
  ['Europe/Paris', 'Central Europe (CET)'],
  ['America/New_York', 'US Eastern (ET)'],
  ['America/Chicago', 'US Central (CT)'],
  ['America/Los_Angeles', 'US Pacific (PT)'],
  ['Australia/Sydney', 'Australia Eastern (AET)'],
];

async function main() {
  let n = 0;
  for (let i = 0; i < SPECIALTIES.length; i++) {
    await prisma.specialty.upsert({ where: { name: SPECIALTIES[i] }, update: { sortOrder: i, active: true }, create: { name: SPECIALTIES[i], sortOrder: i } }); n++;
  }
  for (let i = 0; i < QUALIFICATIONS.length; i++) {
    await prisma.qualification.upsert({ where: { name: QUALIFICATIONS[i] }, update: { sortOrder: i, active: true }, create: { name: QUALIFICATIONS[i], sortOrder: i } }); n++;
  }
  for (let i = 0; i < LANGUAGES.length; i++) {
    await prisma.language.upsert({ where: { name: LANGUAGES[i] }, update: { sortOrder: i, active: true }, create: { name: LANGUAGES[i], sortOrder: i } }); n++;
  }
  for (let i = 0; i < TIMEZONES.length; i++) {
    const [name, label] = TIMEZONES[i];
    await prisma.timezone.upsert({ where: { name }, update: { label, sortOrder: i, active: true }, create: { name, label, sortOrder: i } }); n++;
  }
  console.log(`✅ Master data seeded: ${SPECIALTIES.length} specialties · ${QUALIFICATIONS.length} qualifications · ${LANGUAGES.length} languages · ${TIMEZONES.length} timezones (${n} upserts)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
