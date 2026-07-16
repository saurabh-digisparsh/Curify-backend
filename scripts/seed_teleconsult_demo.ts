/**
 * Seed a bookable teleconsult demo and print the two URLs for a live call.
 * Idempotent-ish: creates a fresh application/doctor/patient + one teleconsult
 * each run. Run: npx ts-node scripts/seed_teleconsult_demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

async function main() {
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const availabilityToken = `demo-avail-${stamp}`;
  const patientEmail = `demo.patient.${stamp}@curify.local`;
  const patientPassword = 'Passw0rd!';

  const app = await prisma.hospitalApplication.create({
    data: { legalName: 'Demo Care Hospital', city: 'Delhi', specialties: ['Cardiology'] },
  });
  const doctor = await prisma.onboardingDoctor.create({
    data: { applicationId: app.id, name: 'Meera Rao', specialty: 'Cardiology', teleconsultEnabled: true, availabilityToken },
  });
  const patient = await prisma.user.create({
    data: {
      email: patientEmail,
      password: await bcrypt.hash(patientPassword, 10),
      name: 'Demo Patient',
      emailVerifiedAt: new Date(), // so they can log in immediately
    },
  });
  const tc = await prisma.teleconsult.create({
    data: { patientId: patient.id, doctorId: doctor.id, scheduledAt: new Date(Date.now() + 5 * 60_000) },
  });

  await prisma.$disconnect();

  console.log('\n─── Teleconsult demo ready ───────────────────────────────\n');
  console.log('DOCTOR (no login — open the availability link, click "Join call"):');
  console.log(`  ${FRONTEND}/availability/${availabilityToken}\n`);
  console.log('PATIENT (log in first, then open the join link):');
  console.log(`  login:  ${patientEmail}  /  ${patientPassword}`);
  console.log(`  join:   ${FRONTEND}/teleconsult/${tc.id}\n`);
  console.log(`teleconsult id: ${tc.id}`);
  console.log('──────────────────────────────────────────────────────────');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
