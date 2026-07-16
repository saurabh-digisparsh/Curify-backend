/**
 * Create ONE fully-onboarded (LIVE) hospital — Apollo Hospitals, Chennai — with
 * every onboarding field filled, in the new partner model, and print its login
 * credentials. Runs directly against the DB (no API needed). Idempotent.
 *
 *   cd backend && npx ts-node scripts/seed_apollo.ts
 */
import { PrismaClient, OnboardingStatus, AccreditationBody, AccreditationSource, DocStatus, OnboardingDoctorStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const HOSPITAL_ID = 'onboard-apollo-chennai';
const LOGIN_EMAIL = 'anita.rao@apollo.example';
const LOGIN_PASSWORD = 'Apollo@1234';

const DOCTORS = [
  { email: 'rajesh.menon@apollo.example', name: 'Rajesh Menon', qualifications: 'MBBS, MS (Ortho)', specialty: 'Orthopedics', subspecialty: 'Knee & hip replacement', registrationNo: 'TNMC/45231', yearsExperience: 22, proceduresPerformed: 1200 },
  { email: 'suresh.iyer@apollo.example', name: 'Suresh Iyer', qualifications: 'MBBS, MD, DM (Cardiology)', specialty: 'Cardiac', subspecialty: 'Interventional cardiology', registrationNo: 'TNMC/38820', yearsExperience: 19, proceduresPerformed: 3400 },
  { email: 'priya.nair@apollo.example', name: 'Priya Nair', qualifications: 'MBBS, MD (OBG)', specialty: 'Fertility', subspecialty: 'IVF & reproductive medicine', registrationNo: 'TNMC/51204', yearsExperience: 15, proceduresPerformed: 2100 },
];

async function main() {
  // Clean any previous Apollo demo rows
  await prisma.surgeon.deleteMany({ where: { hospitalId: HOSPITAL_ID } });
  await prisma.hospitalApplication.deleteMany({ where: { OR: [{ publishedHospitalId: HOSPITAL_ID }, { owner: { email: LOGIN_EMAIL } }] } });
  await prisma.hospital.deleteMany({ where: { id: HOSPITAL_ID } });
  await prisma.user.deleteMany({ where: { email: LOGIN_EMAIL } });

  // Owner account (role HOSPITAL, pre-verified so it can sign in)
  const owner = await prisma.user.create({
    data: { email: LOGIN_EMAIL, name: 'Dr. Anita Rao', role: 'HOSPITAL', country: 'India', password: await bcrypt.hash(LOGIN_PASSWORD, 12), emailVerifiedAt: new Date() },
  });

  // Published directory hospital (go-live output)
  await prisma.hospital.create({
    data: {
      id: HOSPITAL_ID, name: 'Apollo Hospitals', city: 'Chennai', country: 'India', flag: '🇮🇳',
      imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&q=80',
      specialty: 'Multi-Specialty', procedures: ['Knee Replacement', 'Cardiac Bypass Surgery', 'IVF Treatment', 'Cancer Treatment'],
      website: 'https://apollohospitals.com', address: '21 Greams Lane, Thousand Lights, Chennai 600006',
      quotedPriceUsd: 7500, patientsPerYear: 60000, overallRating: 4.8, internationalPercent: '40%',
      jciAccredited: true, nabhAccredited: true, priority: true, ownerUserId: owner.id, approvalStatus: 'APPROVED',
    },
  });

  // Onboarding application (LIVE) with every field
  const app = await prisma.hospitalApplication.create({
    data: {
      legalName: 'Apollo Hospitals', city: 'Chennai', address: '21 Greams Lane, Thousand Lights, Chennai 600006',
      registrationNo: 'TN/CE/2011/0473', ownership: 'Private', website: 'https://apollohospitals.com',
      totalBeds: 550, icuBeds: 60, airportDistanceKm: 14,
      specialties: ['Orthopedics', 'Cardiac', 'Fertility', 'Oncology'],
      insurers: ['Cigna Global', 'Allianz Care', 'Self-pay'],
      languages: ['English', 'Spanish', 'French'],
      intlFacilities: ['Interpreter services', 'Visa / travel assistance', 'Airport pickup', 'Family accommodation'],
      quotedPriceUsd: 7500, patientsPerYear: 60000,
      imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&q=80',
      procedures: ['Knee Replacement', 'Cardiac Bypass Surgery', 'IVF Treatment', 'Cancer Treatment'],
      status: OnboardingStatus.LIVE, priority: true, ownerUserId: owner.id, publishedHospitalId: HOSPITAL_ID,
      contact: { create: { name: 'Dr. Anita Rao', designation: 'Medical Director', workEmail: LOGIN_EMAIL, whatsapp: '+91 98400 12345', emailVerifiedAt: new Date(), whatsappVerifiedAt: new Date() } },
      agreement: { create: { version: '2026-v1', percentage: 15, payoutRail: 'RazorpayX', signatoryName: 'Dr. Anita Rao' } },
      accreditations: { create: [
        { body: AccreditationBody.NABH, identifier: 'NABH-12345', source: AccreditationSource.REGISTRY, status: DocStatus.VERIFIED, verifiedAt: new Date() },
        { body: AccreditationBody.JCI, identifier: 'JCI-0001', source: AccreditationSource.REGISTRY, status: DocStatus.VERIFIED, verifiedAt: new Date() },
      ] },
    },
  });

  // Doctors (onboarding + published Surgeon + weekly availability)
  let primary: string | null = null;
  const links: string[] = [];
  for (const d of DOCTORS) {
    const availabilityToken = randomBytes(24).toString('hex');
    const surgeonId = `doc-${randomBytes(8).toString('hex')}`;
    await prisma.surgeon.create({
      data: { id: surgeonId, hospitalId: HOSPITAL_ID, name: d.name, title: d.qualifications, specialization: d.specialty, email: d.email, medicalCouncilReg: d.registrationNo, yearsExperience: d.yearsExperience, totalProcedures: d.proceduresPerformed, country: 'India', flag: '🇮🇳' },
    });
    await prisma.onboardingDoctor.create({
      data: {
        applicationId: app.id, name: d.name, qualifications: d.qualifications, specialty: d.specialty, subspecialty: d.subspecialty,
        registrationNo: d.registrationNo, email: d.email, yearsExperience: d.yearsExperience, proceduresPerformed: d.proceduresPerformed,
        teleconsultEnabled: true, status: OnboardingDoctorStatus.APPROVED, availabilityToken, publishedSurgeonId: surgeonId,
        windows: { create: [{ weekday: 1, start: '16:00', end: '19:00' }, { weekday: 3, start: '16:00', end: '19:00' }, { weekday: 5, start: '16:00', end: '19:00' }] },
      },
    });
    if (!primary) primary = surgeonId;
    links.push(`   • ${d.specialty.padEnd(14)} Dr. ${d.name.padEnd(15)} ${d.email}`);
  }
  await prisma.hospital.update({ where: { id: HOSPITAL_ID }, data: { surgeonId: primary! } });

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' ✅ Hospital created & LIVE: Apollo Hospitals, Chennai');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  DASHBOARD LOGIN');
  console.log('   URL       : http://localhost:5173/login');
  console.log('   Email     : ' + LOGIN_EMAIL);
  console.log('   Password  : ' + LOGIN_PASSWORD);
  console.log('   → lands on /partner/dashboard');
  console.log('──────────────────────────────────────────────────────────────');
  console.log('  Profile: 550 beds · 60 ICU · NABH + JCI · 4 specialties · 3 doctors');
  console.log('  Doctors:');
  console.log(links.join('\n'));
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
