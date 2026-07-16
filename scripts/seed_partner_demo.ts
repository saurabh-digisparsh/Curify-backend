/**
 * Seed a fully-onboarded (LIVE) demo hospital in the NEW partner model:
 * Fortis Memorial Research Institute + 5 doctors across departments (using the 5
 * provided emails), published into patient matching, with recurring availability.
 * Idempotent — safe to re-run.
 *
 *   cd backend && npx ts-node scripts/seed_partner_demo.ts
 */
import { PrismaClient, OnboardingStatus, AccreditationBody, AccreditationSource, DocStatus, OnboardingDoctorStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const HOSPITAL_ID = 'onboard-fortis-gurugram';
const OWNER_EMAIL = 'onboarding@fortis-gurugram.curify.health';
const OWNER_PASSWORD = 'Hospital@1234';

const DOCTORS = [
  { email: 'robssthe@gmail.com', name: 'Rajesh Menon', qualifications: 'MBBS, MS (Ortho)', specialty: 'Orthopedics & Joint Replacement', registrationNo: 'DMC/R/12841', yearsExperience: 22, proceduresPerformed: 9800 },
  { email: 'wofrumottouwa-7974@yopmail.com', name: 'Ananya Iyer', qualifications: 'MBBS, MD, DM (Cardiology)', specialty: 'Cardiology', registrationNo: 'MMC/2009/33421', yearsExperience: 18, proceduresPerformed: 12500 },
  { email: 'fetrunizaho-4005@yopmail.com', name: 'Vikram Desai', qualifications: 'MBBS, MS, MCh (Onco)', specialty: 'Oncology', registrationNo: 'GMC/2007/55190', yearsExperience: 20, proceduresPerformed: 7300 },
  { email: 'rautottakape-4357@yopmail.com', name: 'Sunita Rao', qualifications: 'MBBS, MCh (Neuro)', specialty: 'Neurology & Neurosurgery', registrationNo: 'KMC/2011/71204', yearsExperience: 16, proceduresPerformed: 4200 },
  { email: 'toicoucihozi-4323@yopmail.com', name: 'Kabir Malhotra', qualifications: 'MBBS, MD (OBG)', specialty: 'Fertility & IVF', registrationNo: 'DMC/R/40987', yearsExperience: 14, proceduresPerformed: 6100 },
];

async function main() {
  // ── Clean previous demo rows ──
  await prisma.surgeon.deleteMany({ where: { hospitalId: HOSPITAL_ID } });
  await prisma.hospitalApplication.deleteMany({ where: { OR: [{ publishedHospitalId: HOSPITAL_ID }, { owner: { email: OWNER_EMAIL } }] } });
  await prisma.hospital.deleteMany({ where: { id: HOSPITAL_ID } });
  await prisma.user.deleteMany({ where: { email: OWNER_EMAIL } });

  // ── Owner (HOSPITAL) ──
  const owner = await prisma.user.create({
    data: { email: OWNER_EMAIL, name: 'Fortis Memorial — Admin', role: 'HOSPITAL', country: 'India', password: await bcrypt.hash(OWNER_PASSWORD, 12), emailVerifiedAt: new Date() },
  });

  // ── Published directory Hospital (go-live output) ──
  await prisma.hospital.create({
    data: {
      id: HOSPITAL_ID, name: 'Fortis Memorial Research Institute', city: 'Gurugram', country: 'India',
      flag: '🇮🇳', imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80',
      specialty: 'Multi-Specialty', procedures: ['Knee Replacement', 'Cardiac Bypass Surgery', 'Cancer Treatment', 'Spine Surgery', 'IVF Treatment'],
      website: 'https://www.fortishealthcare.com', address: 'Sector 44, Gurugram, Haryana 122002',
      quotedPriceUsd: 8200, patientsPerYear: 45000, overallRating: 4.7, internationalPercent: '35%',
      jciAccredited: true, nabhAccredited: true, priority: true,
      ownerUserId: owner.id, approvalStatus: 'APPROVED',
    },
  });

  // ── Onboarding application (LIVE) ──
  const app = await prisma.hospitalApplication.create({
    data: {
      legalName: 'Fortis Memorial Research Institute', city: 'Gurugram', address: 'Sector 44, Gurugram',
      registrationNo: 'HR-HOSP-2011-0442', ownership: 'private', website: 'https://www.fortishealthcare.com',
      totalBeds: 1000, icuBeds: 220, airportDistanceKm: 12,
      specialties: ['Orthopedic', 'Cardiology', 'Oncology', 'Neurology', 'Fertility'],
      insurers: ['Self-pay', 'Star Health', 'HDFC ERGO'], languages: ['English', 'Hindi', 'Arabic'],
      intlFacilities: ['International lounge', 'Interpreter', 'Airport pickup'],
      quotedPriceUsd: 8200, patientsPerYear: 45000, imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80',
      procedures: ['Knee Replacement', 'Cardiac Bypass Surgery', 'Cancer Treatment', 'Spine Surgery', 'IVF Treatment'],
      status: OnboardingStatus.LIVE, priority: true, ownerUserId: owner.id, publishedHospitalId: HOSPITAL_ID,
      contact: { create: { name: 'Dr. A. Rahman', designation: 'Medical Director', workEmail: OWNER_EMAIL, whatsapp: '+91 9812345678', emailVerifiedAt: new Date(), whatsappVerifiedAt: new Date() } },
      agreement: { create: { version: '2026-v1', percentage: 15, payoutRail: 'RazorpayX', signatoryName: 'Dr. A. Rahman' } },
      accreditations: { create: [
        { body: AccreditationBody.NABH, identifier: 'NABH-12345', source: AccreditationSource.REGISTRY, status: DocStatus.VERIFIED, verifiedAt: new Date() },
        { body: AccreditationBody.JCI, identifier: 'JCI-0001', source: AccreditationSource.REGISTRY, status: DocStatus.VERIFIED, verifiedAt: new Date() },
      ] },
    },
  });

  // ── Doctors: onboarding record (+availability) + published Surgeon ──
  const links: string[] = [];
  let primary: string | null = null;
  for (const d of DOCTORS) {
    const availabilityToken = randomBytes(24).toString('hex');
    const surgeonId = `doc-${randomBytes(8).toString('hex')}`;
    await prisma.surgeon.create({
      data: { id: surgeonId, hospitalId: HOSPITAL_ID, name: d.name, title: d.qualifications, specialization: d.specialty, email: d.email, medicalCouncilReg: d.registrationNo, yearsExperience: d.yearsExperience, totalProcedures: d.proceduresPerformed, country: 'India', flag: '🇮🇳' },
    });
    await prisma.onboardingDoctor.create({
      data: {
        applicationId: app.id, name: d.name, qualifications: d.qualifications, specialty: d.specialty,
        registrationNo: d.registrationNo, email: d.email, yearsExperience: d.yearsExperience, proceduresPerformed: d.proceduresPerformed,
        teleconsultEnabled: true, status: OnboardingDoctorStatus.APPROVED, availabilityToken, publishedSurgeonId: surgeonId,
        windows: { create: [
          { weekday: 1, start: '10:00', end: '13:00' }, { weekday: 3, start: '15:00', end: '18:00' }, { weekday: 5, start: '10:00', end: '12:00' },
        ] },
      },
    });
    if (!primary) primary = surgeonId;
    links.push(`   • ${d.specialty.padEnd(28)} ${d.name.padEnd(16)} ${d.email}\n     ${(process.env.FRONTEND_URL || 'http://localhost:5173')}/availability/${availabilityToken}`);
  }
  await prisma.hospital.update({ where: { id: HOSPITAL_ID }, data: { surgeonId: primary! } });

  console.log('\n✅ LIVE demo hospital seeded (new partner model): Fortis Memorial Research Institute');
  console.log('   Hospital login →', OWNER_EMAIL, '/', OWNER_PASSWORD, '  → /partner/dashboard');
  console.log('   Public application flow → /partner');
  console.log('\n   Doctors + availability links:');
  console.log(links.join('\n'));
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
