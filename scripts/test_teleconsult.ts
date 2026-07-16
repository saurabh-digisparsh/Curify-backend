/**
 * End-to-end self-check for the teleconsult video flow (Phase 1).
 * Exercises the real services against the real DB — no HTTP, no Jitsi server:
 *   book -> room minted, patient & doctor tokens share the SAME room,
 *   ownership rejects strangers, and the Jitsi JWT verifies against the secret
 *   with the right room + moderator claims.
 *
 * Run: npx ts-node scripts/test_teleconsult.ts
 */
import 'reflect-metadata';
import * as assert from 'assert';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { SettingsService } from '../src/admin/settings/settings.service';
import { VideoService } from '../src/hospital-partner/video.service';
import { TeleconsultService } from '../src/hospital-partner/teleconsult.service';

// Jitsi config via env — SettingsService resolves override ?? env ?? default.
const SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.JITSI_DOMAIN = 'meet.test.local';
process.env.JITSI_APP_ID = 'curify';
process.env.JITSI_APP_SECRET = SECRET;

async function main() {
  const prisma = new PrismaClient();
  const settings = new SettingsService(prisma as any);
  const video = new VideoService(new JwtService({}), settings);
  const tele = new TeleconsultService(prisma as any, video);

  // ── Seed minimal data ──
  const app = await prisma.hospitalApplication.create({
    data: { legalName: 'Test Hospital', city: 'Delhi', specialties: [] },
  });
  const doctor = await prisma.onboardingDoctor.create({
    data: { applicationId: app.id, name: 'Meera Rao', teleconsultEnabled: true, availabilityToken: 'avail-tok-' + Date.now() },
  });
  const doctorOff = await prisma.onboardingDoctor.create({
    data: { applicationId: app.id, name: 'No Tele', teleconsultEnabled: false, availabilityToken: 'avail-off-' + Date.now() },
  });
  const patient = await prisma.user.create({
    data: { email: `p_${Date.now()}@test.local`, password: 'x', name: 'John Patient' },
  });
  const stranger = await prisma.user.create({
    data: { email: `s_${Date.now()}@test.local`, password: 'x', name: 'Nosy' },
  });

  const cleanup = async () => {
    await prisma.teleconsult.deleteMany({ where: { patientId: { in: [patient.id, stranger.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [patient.id, stranger.id] } } });
    await prisma.hospitalApplication.delete({ where: { id: app.id } }); // cascades doctors
  };

  try {
    // 1. Booking a teleconsult-disabled doctor is rejected.
    await assert.rejects(
      tele.book(patient.id, { doctorId: doctorOff.id, scheduledAt: new Date(Date.now() + 3600e3).toISOString() }),
      /not available/i,
      'booking a non-teleconsult doctor should reject',
    );

    // 2. Happy path booking.
    const tc: any = await tele.book(patient.id, {
      doctorId: doctor.id,
      scheduledAt: new Date(Date.now() + 3600e3).toISOString(),
    });
    const row = await prisma.teleconsult.findFirstOrThrow({ where: { patientId: patient.id } });
    assert.strictEqual(row.status, 'SCHEDULED', 'new teleconsult is SCHEDULED');
    assert.ok(row.roomName && row.roomName.length > 10, 'room name minted');
    console.log(`✓ booked teleconsult ${row.id}, room ${row.roomName}`);

    // 3. Patient token — attendee, correct room, verifiable signature.
    const pt: any = await tele.patientVideoToken(patient.id, row.id);
    assert.strictEqual(pt.provider, 'jitsi');
    const pClaims: any = jwt.verify(pt.jwt, SECRET);
    assert.strictEqual(pClaims.room, row.roomName, 'patient JWT room matches');
    assert.strictEqual(pClaims.iss, 'curify', 'iss = app id');
    assert.strictEqual(pClaims.context.user.moderator, false, 'patient is NOT moderator');
    console.log('✓ patient JWT verifies (attendee, correct room)');

    // 4. Doctor token — moderator, SAME room, verifiable.
    const dt: any = await tele.doctorVideoToken(doctor.availabilityToken!, row.id);
    const dClaims: any = jwt.verify(dt.jwt, SECRET);
    assert.strictEqual(dClaims.room, row.roomName, 'doctor JWT room matches patient room');
    assert.strictEqual(dClaims.context.user.moderator, true, 'doctor IS moderator');
    assert.ok(dClaims.context.user.name.startsWith('Dr '), 'doctor display name prefixed');
    console.log('✓ doctor JWT verifies (moderator, same room)');

    // 5. Ownership: stranger cannot get a patient token.
    await assert.rejects(tele.patientVideoToken(stranger.id, row.id), /not found/i, 'stranger blocked (patient)');
    // 6. Wrong availability token cannot get a doctor token.
    await assert.rejects(tele.doctorVideoToken('bogus-token', row.id), /invalid/i, 'bad token blocked (doctor)');
    console.log('✓ ownership checks reject non-owners');

    // 7. Fail-fast: unconfigured provider -> 503, never an empty-secret sign.
    delete process.env.JITSI_APP_SECRET;
    await assert.rejects(tele.patientVideoToken(patient.id, row.id), /not configured/i, 'missing secret -> 503');
    process.env.JITSI_APP_SECRET = SECRET;
    console.log('✓ fail-fast when provider unconfigured');

    console.log('\nALL CHECKS PASSED');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('\nCHECK FAILED:', e.message);
  process.exit(1);
});
