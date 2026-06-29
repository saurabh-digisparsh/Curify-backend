import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── First Admin ─────────────────────────────────────────────────────────────
  // Admins can only be created by other admins (no public admin signup), so the
  // very first admin is seeded here. Change this password after first login.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'rubenlazarus19@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Ruben@123';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      name: 'Ruben Lazarus',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin ready: ${adminEmail}`);

  // ── Surgeons ──────────────────────────────────────────────────────────────
  const surgeons = [
    { id: 'rajesh', name: 'Dr. Rajesh Malhotra', title: 'Head of Orthopedic Surgery', hospital: 'Apollo Hospitals Chennai', country: 'India', flag: '🇮🇳', specialization: 'Joint Replacement & Sports Injuries', yearsExperience: 22, totalProcedures: 2800, aclSpecific: 1400, successRate: 97.2, complications: 2.1, education: ['MBBS — AIIMS, New Delhi', 'MS Orthopedics — AIIMS', 'Fellowship — Hospital for Special Surgery, New York'], publications: 34, languages: ['Hindi', 'English', 'Tamil'], awards: ['Apollo Excellence Award 2023', 'Best Orthopedic Surgeon India 2022'], patientRating: 4.9, avgSurgeryTime: '90 min', nextAvailable: '2 weeks' },
    { id: 'anil', name: 'Dr. Anil Kumar Sharma', title: 'Director — Orthopedic Surgery', hospital: 'Fortis Memorial Research Institute', country: 'India', flag: '🇮🇳', specialization: 'Knee Surgery & Trauma', yearsExperience: 20, totalProcedures: 2400, aclSpecific: 800, successRate: 95.5, complications: 3.1, education: ['MBBS — Maulana Azad Medical College', 'MS Orthopedics — Safdarjung Hospital', 'Fellowship — University of Toronto'], publications: 18, languages: ['Hindi', 'English', 'Punjabi'], awards: ['Fortis Star Performer 2023'], patientRating: 4.6, avgSurgeryTime: '100 min', nextAvailable: '1 week' },
    { id: 'vikram', name: 'Dr. Vikram Khanna', title: 'Chief of Sports Medicine', hospital: 'Medanta — The Medicity', country: 'India', flag: '🇮🇳', specialization: 'ACL Reconstruction & Arthroscopy', yearsExperience: 18, totalProcedures: 2200, aclSpecific: 1100, successRate: 96.8, complications: 2.3, education: ['MBBS — Armed Forces Medical College', 'MS Orthopedics — PGI Chandigarh', 'Fellowship — Johns Hopkins Hospital'], publications: 28, languages: ['Hindi', 'English', 'Marathi'], awards: ['Medanta Excellence Award 2022', 'National Sports Medicine Award 2021'], patientRating: 4.8, avgSurgeryTime: '85 min', nextAvailable: '10 days' },
    { id: 'suresh', name: 'Dr. Suresh Babu', title: 'Senior Consultant — Orthopedics', hospital: 'Manipal Hospital Bangalore', country: 'India', flag: '🇮🇳', specialization: 'Minimally Invasive Joint Surgery', yearsExperience: 16, totalProcedures: 1800, aclSpecific: 720, successRate: 96.5, complications: 2.5, education: ['MBBS — Bangalore Medical College', 'MS Orthopedics — St. Johns', 'Fellowship — Mayo Clinic'], publications: 22, languages: ['Kannada', 'Hindi', 'English', 'Telugu'], awards: ['Manipal Clinical Excellence 2023'], patientRating: 4.7, avgSurgeryTime: '80 min', nextAvailable: '3 weeks' },
    { id: 'priya', name: 'Dr. Priya Nair', title: 'Consultant Cardiologist', hospital: 'Fortis Memorial Research Institute', country: 'India', flag: '🇮🇳', specialization: 'Interventional Cardiology', yearsExperience: 15, totalProcedures: 2100, aclSpecific: null, successRate: 96.2, complications: 2.8, education: ['MBBS — Grant Medical College Mumbai', 'MD Cardiology — AIIMS', 'FRCP London'], publications: 30, languages: ['Hindi', 'English', 'Malayalam'], awards: ['Fortis Cardiologist of the Year 2023'], patientRating: 4.8, avgSurgeryTime: '180 min', nextAvailable: '5 days' },
  ];

  for (const surgeon of surgeons) {
    await prisma.surgeon.upsert({ where: { id: surgeon.id }, update: surgeon, create: surgeon });
  }

  // ── Hospitals ─────────────────────────────────────────────────────────────
  const hospitals = [
    { id: 'apollo-chennai',    name: 'Apollo Hospitals Chennai',            city: 'Chennai',             country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 88, overallRating: 4.8, quotedPriceUsd: 4500, localPriceUsd: 2800, localBenchmarkUsd: 3200, surgeonId: 'rajesh', mysteryShopperScore: 88, patientsPerYear: 850000, internationalPercent: '40%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement','Hip Replacement','Spine Surgery','Arthroscopy'], intlOfficePhone: '+91-44-2829-0200', intlOfficeEmail: 'international@apollohospitals.com', website: 'https://apollohospitals.com', included: ['Surgery','Anesthesia','5-night stay','Physical therapy (5 sessions)','Pre-op tests','Follow-up consultation'], notIncluded: ['International flights','Airport transfer','Post-discharge rehab'], pros: ['Largest private hospital chain in India','Excellent orthopedic outcomes — 96% success rate','JCI accredited'], cons: ['Higher international pricing markup','Hospital campus can be overwhelming'] },
    { id: 'fortis-delhi',      name: 'Fortis Memorial Research Institute',  city: 'Gurgaon (Delhi NCR)', country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 85, overallRating: 4.6, quotedPriceUsd: 6800, localPriceUsd: 2900, localBenchmarkUsd: 3000, surgeonId: 'priya', mysteryShopperScore: 82, patientsPerYear: 450000, internationalPercent: '30%', specialty: 'Cardiology', procedures: ['Cardiac Bypass Surgery','Angioplasty','Heart Valve Replacement','Pacemaker Implant'], intlOfficePhone: '+91-124-4962200', intlOfficeEmail: 'international@fortishealthcare.com', website: 'https://fortishealthcare.com', included: ['Surgery','Anesthesia','4-night stay','Pre-op evaluation','Airport transfer'], notIncluded: ['Physical therapy beyond 3 sessions','Companion stay'], pros: ['State-of-the-art facility with robotic surgery','Proximity to Delhi airport'], cons: ['Higher price markup','Physical therapy not fully included'] },
    { id: 'medanta-gurgaon',   name: 'Medanta — The Medicity',              city: 'Gurgaon (Delhi NCR)', country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 92, overallRating: 4.7, quotedPriceUsd: 4800, localPriceUsd: 3200, localBenchmarkUsd: 3500, surgeonId: 'vikram', mysteryShopperScore: 90, patientsPerYear: 400000, internationalPercent: '35%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement','Hip Replacement','Spine Fusion','Sports Medicine'], intlOfficePhone: '+91-124-4141414', intlOfficeEmail: 'internationalpatients@medanta.org', website: 'https://medanta.org', included: ['Surgery','Anesthesia','5-night stay','Physical therapy (5 sessions)','Airport transfer','Translator','Pre-op tests'], notIncluded: ['International flights','Extended stay'], pros: ['All-inclusive packages with no hidden fees','World-class infrastructure'], cons: ['Premium pricing','Gurgaon traffic can cause delays'] },
    { id: 'max-delhi',         name: 'Max Super Speciality Hospital',        city: 'Saket, New Delhi',    country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 84, overallRating: 4.5, quotedPriceUsd: 3900, localPriceUsd: 2200, localBenchmarkUsd: 2800, surgeonId: 'anil', mysteryShopperScore: 74, patientsPerYear: 520000, internationalPercent: '25%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement','Hip Replacement'], intlOfficePhone: '+91-11-2651-5050', intlOfficeEmail: 'intl.patients@maxhealthcare.in', website: 'https://maxhealthcare.in', included: ['Surgery','Anesthesia','3-night stay','Pre-op tests'], notIncluded: ['Physical therapy','Airport transfer','Translator'], pros: ['Most affordable JCI-accredited option','Central Delhi location'], cons: ['Higher price markup ratio','Bare-bones package'] },
    { id: 'kokilaben-mumbai',  name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai',              country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 93, overallRating: 4.7, quotedPriceUsd: 5100, localPriceUsd: 3600, localBenchmarkUsd: 4000, surgeonId: 'vikram', mysteryShopperScore: 91, patientsPerYear: 280000, internationalPercent: '30%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement','Hip Replacement','Robotic Surgery'], intlOfficePhone: '+91-22-4269-6969', intlOfficeEmail: 'international@kokilabenhospital.com', website: 'https://kokilabenhospital.com', included: ['Surgery','Anesthesia','5-night stay','Physical therapy (7 sessions)','Private room','Meals','Airport VIP transfer'], notIncluded: ['International flights','Travel insurance'], pros: ['Premium luxury hospital experience','Most comprehensive included package'], cons: ['Highest price point','Mumbai traffic'] },
    { id: 'manipal-bangalore', name: 'Manipal Hospital Bangalore',          city: 'Bangalore',           country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 90, overallRating: 4.6, quotedPriceUsd: 4000, localPriceUsd: 2600, localBenchmarkUsd: 3100, surgeonId: 'suresh', mysteryShopperScore: 86, patientsPerYear: 350000, internationalPercent: '28%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement','Hip Replacement','Arthroscopy'], intlOfficePhone: '+91-80-2222-4444', intlOfficeEmail: 'intl@manipalhospitals.com', website: 'https://manipalhospitals.com', included: ['Surgery','Anesthesia','4-night stay','Physical therapy (4 sessions)','Airport pickup'], notIncluded: ['Companion accommodation','Extended rehab'], pros: ["Best value-for-money","Bangalore's pleasant climate"], cons: ['Airport is far from hospital','Less luxurious'] },
    { id: 'narayana-bangalore', name: 'Narayana Health City',               city: 'Bangalore',           country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 95, overallRating: 4.5, quotedPriceUsd: 3500, localPriceUsd: 2400, localBenchmarkUsd: 2700, surgeonId: 'suresh', mysteryShopperScore: 82, patientsPerYear: 700000, internationalPercent: '20%', specialty: 'Cardiology', procedures: ['Cardiac Bypass Surgery','Angioplasty','Heart Valve Replacement','Congenital Heart'], intlOfficePhone: '+91-80-7122-2222', intlOfficeEmail: 'international@narayanahealth.org', website: 'https://narayanahealth.org', included: ['Surgery','Anesthesia','4-night stay','Physical therapy (3 sessions)'], notIncluded: ['Airport transfer','Translator'], pros: ['Fairest pricing — minimal markup','High surgical volume'], cons: ['No-frills experience','Very high patient volume'] },
    { id: 'blk-delhi',         name: 'BLK-Max Super Speciality Hospital',   city: 'New Delhi',           country: 'India', flag: '🇮🇳', jciAccredited: true, fairnessScore: 86, overallRating: 4.4, quotedPriceUsd: 3800, localPriceUsd: 2300, localBenchmarkUsd: 2900, surgeonId: 'anil', mysteryShopperScore: 72, patientsPerYear: 380000, internationalPercent: '22%', specialty: 'Orthopedic', procedures: ['ACL Reconstruction','Knee Replacement'], intlOfficePhone: '+91-11-3040-3040', intlOfficeEmail: 'international@blkmax.com', website: 'https://blkmax.com', included: ['Surgery','Anesthesia','3-night stay','Pre-op tests','Translator'], notIncluded: ['Physical therapy','Airport transfer'], pros: ['Budget-friendly with decent quality','Central Delhi location'], cons: ['Older facility','Bare-bones package'] },
  ];

  for (const hospital of hospitals) {
    await prisma.hospital.upsert({ where: { id: hospital.id }, update: hospital, create: hospital });
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  const reviews = [
    { id: 'rev-1',  hospitalId: 'apollo-chennai',     surgeonId: 'rajesh', reviewerName: 'Chidinma A.', nationality: 'NG Nigerian',      age: 38, procedure: 'ACL Reconstruction', rating: 5, reviewDate: 'Aug 15, 2024', text: "Everything was seamless from airport to recovery. Dr. Rajesh explained every step. Apollo's international office even had a coordinator who spoke basic Yoruba! World-class experience.", verified: true },
    { id: 'rev-2',  hospitalId: 'apollo-chennai',     surgeonId: 'rajesh', reviewerName: 'Fatima B.',   nationality: 'KE Kenyan',        age: 45, procedure: 'Knee Replacement',   rating: 5, reviewDate: 'Jun 22, 2024', text: 'I compared 5 hospitals across India. Apollo Chennai had the best team and communication. Recovery support was excellent.', verified: true },
    { id: 'rev-3',  hospitalId: 'apollo-chennai',     surgeonId: 'rajesh', reviewerName: 'David O.',    nationality: 'NG Nigerian',      age: 48, procedure: 'Meniscus Repair',    rating: 4, reviewDate: 'Mar 28, 2024', text: "Surgery went perfectly. Dr. Malhotra is a genius. Communication could be better — some nurses didn't speak English well.", verified: true },
    { id: 'rev-4',  hospitalId: 'fortis-delhi',       surgeonId: 'anil',   reviewerName: 'Ibrahim K.', nationality: 'NG Nigerian',      age: 52, procedure: 'ACL Reconstruction', rating: 4, reviewDate: 'Jul 10, 2024', text: 'Great surgical outcome — my knee feels brand new. The hospital is modern and well-equipped. Dr. Sharma is truly skilled.', verified: true },
    { id: 'rev-5',  hospitalId: 'fortis-delhi',       surgeonId: 'anil',   reviewerName: 'Yemi A.',    nationality: 'NG Nigerian',      age: 44, procedure: 'ACL Reconstruction', rating: 4, reviewDate: 'Sep 15, 2024', text: 'Excellent surgery outcome, walking within 24 hours. Fortis Gurgaon is very modern.', verified: true },
    { id: 'rev-6',  hospitalId: 'medanta-gurgaon',    surgeonId: 'vikram', reviewerName: 'Amina D.',   nationality: 'GH Ghanaian',      age: 35, procedure: 'ACL Reconstruction', rating: 5, reviewDate: 'Sep 5, 2024',  text: "Dr. Khanna was incredible — trained at Johns Hopkins and it shows. The international patient lounge made us feel at home.", verified: true },
    { id: 'rev-7',  hospitalId: 'medanta-gurgaon',    surgeonId: 'vikram', reviewerName: 'Kwame N.',   nationality: 'GH Ghanaian',      age: 41, procedure: 'ACL Reconstruction', rating: 5, reviewDate: 'Oct 20, 2024', text: "Medanta's all-inclusive package is the best value in Delhi NCR. No hidden fees, everything was transparent.", verified: true },
    { id: 'rev-8',  hospitalId: 'max-delhi',          surgeonId: 'anil',   reviewerName: 'Oluwaseun T.', nationality: 'NG Nigerian',    age: 40, procedure: 'ACL Reconstruction', rating: 4, reviewDate: 'May 18, 2024', text: "Good surgery, good result. The savings were significant — cheapest JCI-accredited option I found in India.", verified: true },
    { id: 'rev-9',  hospitalId: 'kokilaben-mumbai',   surgeonId: 'vikram', reviewerName: 'Sarah M.',   nationality: 'ZA South African', age: 33, procedure: 'ACL Reconstruction', rating: 5, reviewDate: 'Apr 12, 2024', text: "Luxury experience in Mumbai. Kokilaben feels like a 5-star hotel with a hospital inside. I was back on my feet faster than my friend who had the same surgery in Jo'burg.", verified: true },
    { id: 'rev-10', hospitalId: 'manipal-bangalore',  surgeonId: 'suresh', reviewerName: 'Grace L.',   nationality: 'KE Kenyan',        age: 37, procedure: 'ACL Reconstruction', rating: 4, reviewDate: 'Jul 30, 2024', text: "Bangalore's weather was perfect for recovery. Manipal Hospital is efficient and well-run.", verified: true },
    { id: 'rev-11', hospitalId: 'narayana-bangalore', surgeonId: 'suresh', reviewerName: 'Abdul R.',   nationality: 'NG Nigerian',      age: 55, procedure: 'Knee Replacement',   rating: 4, reviewDate: 'Aug 8, 2024',  text: "Best value hospital in India! Narayana Health is no-frills but the surgical quality is excellent.", verified: true },
    { id: 'rev-12', hospitalId: 'blk-delhi',          surgeonId: 'anil',   reviewerName: 'Joseph M.', nationality: 'TZ Tanzanian',     age: 39, procedure: 'ACL Reconstruction', rating: 3, reviewDate: 'Jun 5, 2024',  text: "Budget option in Delhi and the surgery went fine. Good if you're on a tight budget and self-sufficient.", verified: true },
  ];

  for (const review of reviews) {
    await prisma.review.upsert({ where: { id: review.id }, update: review, create: review });
  }

  // ── Stay or Go Templates ──────────────────────────────────────────────────
  const stayOrGoTemplates = [
    // ACL Reconstruction
    { procedure: 'ACL Reconstruction', homeCountry: 'Nigeria',        homeCost: '$500–$1,500',  homeWaitTime: '3–6 months',   homeSuccessRate: '68%', homeRisk: 'High (limited sports-medicine specialists)',       homeQuality: 'Variable',    indiaCost: '$4,500–$7,000', indiaWaitTime: '1–2 weeks', indiaSuccessRate: '94%', indiaRisk: 'Low (JCI-accredited centres)',       indiaQuality: 'World-class', recommendation: 'Go',         reasoning: 'India offers 26% higher success rates and 4× faster access at comparable all-in cost. The risk of delayed ACL surgery includes cartilage degradation and chronic instability.', summary: ['Wait time in Nigeria averages 3–6 months for specialist access','India JCI hospitals achieve 94% vs 68% regional success rate','All-in cost including flights is typically $6,000–$9,000 vs $1,500 locally but with dramatically better outcomes'], riskTimeline: [{ month: 0, risk: 10, label: 'Baseline' },{ month: 1, risk: 18, label: '+8% degradation' },{ month: 3, risk: 34, label: 'Cartilage stress' },{ month: 6, risk: 52, label: 'Chronic instability' },{ month: 12, risk: 71, label: 'Likely OA onset' }] },
    { procedure: 'ACL Reconstruction', homeCountry: 'Kenya',          homeCost: '$800–$2,000',  homeWaitTime: '2–4 months',   homeSuccessRate: '72%', homeRisk: 'Medium (specialist shortage in public system)',     homeQuality: 'Good',        indiaCost: '$4,500–$7,000', indiaWaitTime: '1–2 weeks', indiaSuccessRate: '94%', indiaRisk: 'Low',                               indiaQuality: 'World-class', recommendation: 'Go',         reasoning: 'Strong outcome improvement with reasonable cost delta. Nairobi private surgeons are good but volume and experience lag India JCI centres.', summary: ['Kenya private surgeons competent but India JCI outcomes are superior','Wait time 2–4 months vs 1–2 weeks in India','Flight from Nairobi to Chennai is under $800 round-trip'], riskTimeline: [{ month: 0, risk: 10, label: 'Baseline' },{ month: 1, risk: 16, label: '+6% degradation' },{ month: 3, risk: 28, label: 'Tissue stress' },{ month: 6, risk: 44, label: 'Chronic instability' },{ month: 12, risk: 62, label: 'Long-term damage risk' }] },
    { procedure: 'ACL Reconstruction', homeCountry: 'Ghana',          homeCost: '$600–$1,800',  homeWaitTime: '3–5 months',   homeSuccessRate: '65%', homeRisk: 'High (very limited arthroscopic surgeons)',         homeQuality: 'Variable',    indiaCost: '$4,500–$7,000', indiaWaitTime: '1–2 weeks', indiaSuccessRate: '94%', indiaRisk: 'Low',                               indiaQuality: 'World-class', recommendation: 'Go',         reasoning: 'Ghana has very limited arthroscopic surgical capacity. Delayed ACL repair leads to meniscal damage and early osteoarthritis.', summary: ['Arthroscopic ACL surgery almost unavailable at quality level in Ghana','29% better outcomes in India','Early osteoarthritis risk from delay is significant'], riskTimeline: [{ month: 0, risk: 12, label: 'Baseline' },{ month: 1, risk: 20, label: '+8% degradation' },{ month: 3, risk: 36, label: 'Cartilage stress' },{ month: 6, risk: 56, label: 'Meniscal damage' },{ month: 12, risk: 74, label: 'Early OA onset' }] },
    { procedure: 'ACL Reconstruction', homeCountry: 'United Kingdom', homeCost: '$0 (NHS)',     homeWaitTime: '6–12 months',  homeSuccessRate: '90%', homeRisk: 'Low (NHS quality excellent, wait is the risk)',    homeQuality: 'Excellent',   indiaCost: '$4,500–$7,000', indiaWaitTime: '1–2 weeks', indiaSuccessRate: '94%', indiaRisk: 'Low',                               indiaQuality: 'World-class', recommendation: 'Borderline', reasoning: 'NHS ACL outcomes are excellent. The primary factor is wait time — 6–12 months vs 1–2 weeks in India. If privately insured, consider staying. If on NHS list, India is worth considering.', summary: ['NHS surgical quality is world-class — outcomes comparable to India','6–12 month wait causes muscle atrophy and cartilage degradation','India costs $4,500–$7,000 all-in; private UK surgery costs $7,000–$12,000'], riskTimeline: [{ month: 0, risk: 5, label: 'Baseline' },{ month: 1, risk: 9, label: 'Muscle weakening' },{ month: 3, risk: 16, label: 'Cartilage stress' },{ month: 6, risk: 26, label: 'Increased instability' },{ month: 12, risk: 38, label: 'Secondary injury risk' }] },
    { procedure: 'ACL Reconstruction', homeCountry: 'UAE',            homeCost: '$6,000–$12,000', homeWaitTime: '2–4 weeks',  homeSuccessRate: '88%', homeRisk: 'Low (good private sector)',                        homeQuality: 'Excellent',   indiaCost: '$4,500–$7,000', indiaWaitTime: '1–2 weeks', indiaSuccessRate: '94%', indiaRisk: 'Low',                               indiaQuality: 'World-class', recommendation: 'Go',         reasoning: 'India costs 40–50% less than UAE private hospitals for equivalent or better outcomes. Short flight from Dubai makes India a clear choice.', summary: ['UAE private surgery costs $6,000–$12,000 vs $4,500–$7,000 in India','India JCI outcomes superior to UAE average','Dubai to Chennai is a 4-hour direct flight'], riskTimeline: [{ month: 0, risk: 5, label: 'Baseline' },{ month: 1, risk: 8, label: 'Minor weakening' },{ month: 3, risk: 14, label: 'Tissue stress' },{ month: 6, risk: 22, label: 'Instability risk' },{ month: 12, risk: 34, label: 'Long-term damage' }] },
    // Knee Replacement
    { procedure: 'Knee Replacement', homeCountry: 'Nigeria', homeCost: '$1,000–$3,000', homeWaitTime: '6–12 months', homeSuccessRate: '62%', homeRisk: 'High (implant quality and surgeon experience variable)', homeQuality: 'Variable', indiaCost: '$7,000–$10,000', indiaWaitTime: '2–3 weeks', indiaSuccessRate: '93%', indiaRisk: 'Low (JCI-accredited)', indiaQuality: 'Excellent', recommendation: 'Go', reasoning: 'Critical recommendation. A 12-month wait causes 40% cartilage deterioration and the low success rate in Nigeria risks early implant failure. India outcomes are dramatically better.', summary: ['62% vs 93% success rate is a life-quality difference','12-month wait causes significant joint deterioration','India all-in cost $9,000–$13,000 vs $3,000 local with 31% worse outcomes'], riskTimeline: [{ month: 0, risk: 15, label: 'Baseline' },{ month: 1, risk: 24, label: 'Cartilage loss' },{ month: 3, risk: 40, label: 'Bone-on-bone friction' },{ month: 6, risk: 58, label: 'Severe deterioration' },{ month: 12, risk: 78, label: 'Revision likely needed' }] },
    { procedure: 'Knee Replacement', homeCountry: 'United Kingdom', homeCost: '$0 (NHS)', homeWaitTime: '12–18 months', homeSuccessRate: '89%', homeRisk: 'Low (excellent NHS outcomes, long wait is the risk)', homeQuality: 'Excellent', indiaCost: '$7,000–$10,000', indiaWaitTime: '2–3 weeks', indiaSuccessRate: '93%', indiaRisk: 'Low', indiaQuality: 'Excellent', recommendation: 'Borderline', reasoning: 'NHS quality is excellent but 12–18 month wait for knee replacement causes significant quality-of-life degradation and cartilage damage. If pain is severe, India is worth the cost.', summary: ['18-month NHS wait causes measurable cartilage deterioration','India outcomes 4% better; cost is $7,000–$10,000 out-of-pocket','If severe daily pain, India trip likely pays off in quality of life'], riskTimeline: [{ month: 0, risk: 8, label: 'Baseline' },{ month: 3, risk: 16, label: 'Cartilage stress' },{ month: 6, risk: 28, label: 'Bone changes' },{ month: 12, risk: 44, label: 'Significant deterioration' },{ month: 18, risk: 61, label: 'Revision risk increased' }] },
    // Cardiac Bypass
    { procedure: 'Cardiac Bypass Surgery', homeCountry: 'Nigeria', homeCost: '$2,000–$6,000', homeWaitTime: '3–9 months', homeSuccessRate: '58%', homeRisk: 'Very High (cardiac surgeon shortage, limited ICU capacity)', homeQuality: 'Limited', indiaCost: '$10,000–$18,000', indiaWaitTime: '1–3 weeks', indiaSuccessRate: '92%', indiaRisk: 'Low', indiaQuality: 'World-class', recommendation: 'Go', reasoning: 'Urgent recommendation. 58% success rate in Nigeria for cardiac bypass is dangerously low. The 3–9 month wait with a compromised heart is life-threatening. India JCI cardiac centres achieve 92% success.', summary: ['34% better survival outcome in India — this is a life-or-death difference','9-month wait with cardiac bypass need is extremely high-risk','India all-in cost $12,000–$22,000 vs life-threatening delay locally'], riskTimeline: [{ month: 0, risk: 20, label: 'Baseline' },{ month: 1, risk: 32, label: 'Cardiac stress' },{ month: 3, risk: 52, label: 'Heart failure risk' },{ month: 6, risk: 70, label: 'Critical danger' },{ month: 12, risk: 88, label: 'High mortality risk' }] },
    { procedure: 'Cardiac Bypass Surgery', homeCountry: 'Kenya', homeCost: '$3,000–$8,000', homeWaitTime: '2–6 months', homeSuccessRate: '72%', homeRisk: 'High (limited ICU capacity, variable surgeon experience)', homeQuality: 'Variable', indiaCost: '$10,000–$18,000', indiaWaitTime: '1–3 weeks', indiaSuccessRate: '92%', indiaRisk: 'Low', indiaQuality: 'World-class', recommendation: 'Go', reasoning: 'Kenya has competent cardiac surgeons but ICU capacity and outcomes lag India JCI cardiac centres. The 20% outcome improvement justifies the cost difference.', summary: ['20% better outcome in India for complex bypass cases','Nairobi best cardiac centres charge $8,000 with shorter wait than Nigeria','India flight cost adds $800–$1,500 from Nairobi'], riskTimeline: [{ month: 0, risk: 15, label: 'Baseline' },{ month: 1, risk: 24, label: 'Cardiac stress' },{ month: 3, risk: 42, label: 'Heart failure risk increasing' },{ month: 6, risk: 60, label: 'High danger zone' },{ month: 12, risk: 78, label: 'Very high mortality risk' }] },
    // Hip Replacement
    { procedure: 'Hip Replacement', homeCountry: 'Nigeria', homeCost: '$1,200–$4,000', homeWaitTime: '6–18 months', homeSuccessRate: '60%', homeRisk: 'High (implant quality variable, limited revision capacity)', homeQuality: 'Variable', indiaCost: '$6,000–$9,000', indiaWaitTime: '2–3 weeks', indiaSuccessRate: '92%', indiaRisk: 'Low', indiaQuality: 'Excellent', recommendation: 'Go', reasoning: 'Hip replacement failure in Nigeria often requires revision surgery that is unavailable locally. India provides superior implants and 32% better outcomes.', summary: ['32% better success rate in India','Revision hip surgery essentially unavailable in Nigeria if implant fails','India all-in $8,000–$12,000 secures a reliable implant with 20-year lifespan'], riskTimeline: [{ month: 0, risk: 12, label: 'Baseline' },{ month: 3, risk: 22, label: 'Joint degradation' },{ month: 6, risk: 38, label: 'Bone damage' },{ month: 12, risk: 58, label: 'Severe deterioration' },{ month: 18, risk: 76, label: 'Revision needed' }] },
    // IVF
    { procedure: 'IVF Treatment', homeCountry: 'Nigeria', homeCost: '$1,500–$3,000', homeWaitTime: '1–3 months', homeSuccessRate: '28%', homeRisk: 'Medium (success rate significantly lower than India)', homeQuality: 'Variable', indiaCost: '$2,500–$4,500', indiaWaitTime: '2–4 weeks', indiaSuccessRate: '52%', indiaRisk: 'Low', indiaQuality: 'Excellent', recommendation: 'Go', reasoning: 'India IVF success rate is nearly double that of Nigeria (52% vs 28%) at only modestly higher cost. The emotional and financial cost of multiple failed cycles in Nigeria far exceeds a single India trip.', summary: ['52% vs 28% per-cycle success rate — nearly double the chance','India cost is only $1,000–$1,500 more per cycle than Nigeria','Multiple failed Nigeria cycles cost more than a single India trip'], riskTimeline: [{ month: 0, risk: 0, label: 'Emotional baseline' },{ month: 1, risk: 10, label: 'Failed cycle stress' },{ month: 3, risk: 22, label: 'Mental health impact' },{ month: 6, risk: 38, label: 'Relationship strain' },{ month: 12, risk: 55, label: 'Long-term wellbeing risk' }] },
  ];

  for (const t of stayOrGoTemplates) {
    await prisma.stayOrGoTemplate.upsert({
      where: { procedure_homeCountry: { procedure: t.procedure, homeCountry: t.homeCountry } },
      update: { ...t, summary: t.summary, riskTimeline: t.riskTimeline },
      create: { ...t, summary: t.summary, riskTimeline: t.riskTimeline },
    });
  }

  // ── Trip Plan Templates ───────────────────────────────────────────────────
  const tripPlanTemplates = [
    {
      procedure: 'ACL Reconstruction', destination: 'Chennai',
      timeline: [
        { day: 'Day 1', phase: 'arrival', title: 'Arrive in Chennai', description: 'Airport pickup by Apollo coordinator. Check in to recovery-friendly hotel 10 min from hospital. Rest and hydrate.', icon: '✈️' },
        { day: 'Day 2', phase: 'pre-surgery', title: 'Pre-Op Consultation', description: 'Meet Dr. Malhotra. Review MRI, blood work, anaesthesia assessment. Sign consent forms.', icon: '🏥' },
        { day: 'Day 3', phase: 'surgery', title: 'ACL Reconstruction', description: 'Arthroscopic surgery (~90 mins). Transferred to private recovery room. Cryo-therapy begins.', icon: '⚕️' },
        { day: 'Days 4–7', phase: 'recovery', title: 'In-Hospital Recovery', description: 'Physiotherapy starts Day 4. Pain management, wound checks. Discharge Day 7 if stable.', icon: '🛏️' },
        { day: 'Days 8–14', phase: 'recovery', title: 'Outpatient Rehab', description: 'Daily physio sessions at Apollo outpatient centre. Gait training, range-of-motion exercises.', icon: '🦵' },
        { day: 'Day 15', phase: 'return', title: 'Departure', description: 'Final sign-off from Dr. Malhotra. Carry discharge summary and medication list. Fly home.', icon: '🏠' },
        { day: 'Weeks 3–12', phase: 'follow-up', title: 'Remote Follow-Up', description: 'Video consultations at Week 3, 6, 12. Share physio notes. Curify care team on standby 24/7.', icon: '📱' },
      ],
      costs: { surgeryFee: 4500, accommodation: 980, meals: 280, transport: 320, physio: 450, medications: 120, visa: 80 },
      totalEstimate: '$6,200–$8,500',
      travelTips: ['Apply for Indian medical visa (Category M) — process at indianvisaonline.gov.in, 2–3 business days', 'Apollo Chennai international desk: +91-44-2829-0200 — they coordinate airport pickup', 'Pack loose-fitting clothing for your knee — compression garments provided by hospital', 'Carry 6 weeks of any regular medication from home — local refills are possible but slower', 'Book accommodation on Anna Nagar or Nungambakkam — 10–15 min to Apollo by auto or cab'],
      insuranceAlert: 'SafetyWing covers post-surgical complications abroad. Purchase before departure.',
    },
    {
      procedure: 'ACL Reconstruction', destination: 'Delhi',
      timeline: [
        { day: 'Day 1', phase: 'arrival', title: 'Arrive at IGI Airport, Delhi', description: 'Medanta/Fortis coordinator pickup. Hotel in Gurgaon — 20 min to hospital. Acclimatise.', icon: '✈️' },
        { day: 'Day 2', phase: 'pre-surgery', title: 'Pre-Op Evaluation', description: 'Full workup: MRI, blood panel, ECG, anaesthesia consultation. Meet surgeon.', icon: '🏥' },
        { day: 'Day 3', phase: 'surgery', title: 'ACL Reconstruction', description: 'Arthroscopic procedure under spinal or general anaesthesia. 85–100 min. ICU for 2 hrs then ward.', icon: '⚕️' },
        { day: 'Days 4–6', phase: 'recovery', title: 'In-Hospital Recovery', description: 'Physio starts Day 4. Crutch training. Wound check. Discharge Day 6.', icon: '🛏️' },
        { day: 'Days 7–14', phase: 'recovery', title: 'Outpatient Physio', description: 'Twice-daily physio at hospital outpatient. Pool therapy if available.', icon: '🦵' },
        { day: 'Day 15', phase: 'return', title: 'Return Flight', description: 'Final clearance from surgeon. Compression stocking for flight. Discharge summary in English.', icon: '🏠' },
        { day: 'Weeks 3–12', phase: 'follow-up', title: 'Remote Check-Ins', description: 'Video calls with surgeon team at Week 3, 6, 12. Physio notes shared digitally.', icon: '📱' },
      ],
      costs: { surgeryFee: 4800, accommodation: 1050, meals: 300, transport: 350, physio: 500, medications: 130, visa: 80 },
      totalEstimate: '$6,800–$9,200',
      travelTips: ['Delhi/NCR area is large — stay in Gurgaon for Medanta/Fortis, or Saket for Max', 'Gurgaon Cyber City has many international restaurants and pharmacies', 'Delhi metro links airport to city — but hospital taxi is easiest with knee injury', 'Book accommodation with elevator access — stairs post-ACL are painful', 'Pollution in Delhi Oct–Jan is high — bring N95 masks if travelling in winter'],
      insuranceAlert: 'Declare surgery to travel insurer before departure. Some policies require prior authorisation.',
    },
    {
      procedure: 'Knee Replacement', destination: 'Chennai',
      timeline: [
        { day: 'Day 1', phase: 'arrival', title: 'Arrive in Chennai', description: 'Apollo hospital coordinator meets you at airport. Check into hospital-affiliated accommodation.', icon: '✈️' },
        { day: 'Day 2', phase: 'pre-surgery', title: 'Pre-Op Assessment', description: 'Orthopaedic consultation, X-rays, blood work, cardiac clearance. Plan anaesthesia.', icon: '🏥' },
        { day: 'Day 3', phase: 'surgery', title: 'Total Knee Replacement', description: 'Surgery 2–3 hours. Titanium/ceramic implant. Transferred to ward post-recovery.', icon: '⚕️' },
        { day: 'Days 4–7', phase: 'recovery', title: 'Acute Recovery', description: 'Physio Day 1 post-op — standing and first steps. Pain managed. Wound monitoring.', icon: '🛏️' },
        { day: 'Days 8–21', phase: 'recovery', title: 'Rehab Programme', description: 'Daily physio. Stair climbing, gait training. 90% of patients walking unaided by Day 14.', icon: '🦵' },
        { day: 'Day 21', phase: 'return', title: 'Fly Home', description: 'Cleared to travel. Request aisle seat and compression stockings. Avoid long layovers.', icon: '🏠' },
        { day: 'Months 1–3', phase: 'follow-up', title: 'Home Physio + Remote Follow-Up', description: 'Monthly video call with surgeon. Home physio programme provided. Full recovery 3–6 months.', icon: '📱' },
      ],
      costs: { surgeryFee: 7200, accommodation: 1400, meals: 380, transport: 320, physio: 650, medications: 180, visa: 80 },
      totalEstimate: '$9,800–$13,000',
      travelTips: ['Knee replacement requires 21+ days minimum in country — plan for 3 weeks', 'Book ground floor or elevator accommodation — stairs are difficult first 2 weeks', 'Apollo Chennai international office arranges full coordination including physio scheduling', 'Bring comfortable walking shoes 1–2 sizes larger — post-op swelling is expected', 'Request discharge summary with implant details — important for airport security and home GP'],
      insuranceAlert: 'Elective surgery may void basic travel insurance. Purchase medical travel insurance before booking.',
    },
    {
      procedure: 'Cardiac Bypass Surgery', destination: 'Delhi',
      timeline: [
        { day: 'Day 1', phase: 'arrival', title: 'Arrive at IGI Delhi', description: 'Fortis/Medanta cardiac coordinator pickup. Direct to hospital for admission. ECG and bloods on arrival.', icon: '✈️' },
        { day: 'Days 2–3', phase: 'pre-surgery', title: 'Cardiac Pre-Op', description: 'Echocardiogram, coronary angiogram, lung function, renal panel. Cardiology team review.', icon: '🏥' },
        { day: 'Day 4', phase: 'surgery', title: 'Bypass Surgery (CABG)', description: 'On-pump or off-pump bypass. 3–5 hours. Transferred to cardiac ICU post-surgery.', icon: '⚕️' },
        { day: 'Days 5–8', phase: 'recovery', title: 'Cardiac ICU Recovery', description: 'Ventilator support (extubated Day 1 usually). Cardiac monitoring. Mobilisation Day 3.', icon: '🛏️' },
        { day: 'Days 9–14', phase: 'recovery', title: 'Ward and Cardiac Rehab', description: 'Progressive walking programme. Diet counselling. Sternal wound care.', icon: '🦵' },
        { day: 'Day 21', phase: 'return', title: 'Medical Clearance to Fly', description: 'Cardiac surgeon clears for air travel. Request medical letter for airline. No window seat — aisle only.', icon: '🏠' },
        { day: 'Months 1–6', phase: 'follow-up', title: 'Remote Cardiology Follow-Up', description: 'Monthly video consultation. ECG results shared digitally. Medication review.', icon: '📱' },
      ],
      costs: { surgeryFee: 13000, accommodation: 1800, meals: 420, transport: 350, physio: 0, medications: 380, visa: 80 },
      totalEstimate: '$16,000–$22,000',
      travelTips: ['Cardiac bypass requires minimum 21 days in India — book flexible return ticket', 'Bring a companion — cardiac recovery benefits significantly from family presence', 'Fortis Gurgaon has one of Indias best cardiac ICU departments', 'Carry a detailed list of all current medications with generic names not brand names', 'Avoid direct long-haul flights home immediately — a one-night layover reduces DVT risk'],
      insuranceAlert: 'Cardiac surgery requires specialist medical travel insurance. Declare pre-existing conditions. SafetyWing does not cover pre-existing cardiac conditions without rider.',
    },
  ];

  for (const t of tripPlanTemplates) {
    await prisma.tripPlanTemplate.upsert({
      where: { procedure_destination: { procedure: t.procedure, destination: t.destination } },
      update: { ...t, timeline: t.timeline, costs: t.costs, travelTips: t.travelTips },
      create: { ...t, timeline: t.timeline, costs: t.costs, travelTips: t.travelTips },
    });
  }

  // ── Flight Options ────────────────────────────────────────────────────────
  await prisma.flightOption.deleteMany();
  await prisma.flightOption.createMany({ data: [
    { origin: 'Lagos',   destination: 'Chennai',   airline: 'Emirates (via Dubai)',         price: 980,  duration: '14h 20m', stops: '1 stop (Dubai)',      label: null },
    { origin: 'Lagos',   destination: 'Chennai',   airline: 'Ethiopian Airlines (via Addis)',price: 820,  duration: '16h 05m', stops: '1 stop (Addis Ababa)', label: 'Best Value' },
    { origin: 'Lagos',   destination: 'Chennai',   airline: 'Air India (via Mumbai)',       price: 1050, duration: '12h 40m', stops: '1 stop (Mumbai)',      label: null },
    { origin: 'Nairobi', destination: 'Chennai',   airline: 'Kenya Airways (direct)',       price: 760,  duration: '8h 55m',  stops: 'Direct',              label: 'Best Value' },
    { origin: 'Nairobi', destination: 'Chennai',   airline: 'Emirates (via Dubai)',         price: 890,  duration: '11h 40m', stops: '1 stop (Dubai)',      label: null },
    { origin: 'Accra',   destination: 'Chennai',   airline: 'Ethiopian Airlines (via Addis)',price: 870,  duration: '14h 20m', stops: '1 stop (Addis Ababa)', label: 'Best Value' },
    { origin: 'Accra',   destination: 'Chennai',   airline: 'Qatar Airways (via Doha)',    price: 1020, duration: '13h 50m', stops: '1 stop (Doha)',        label: null },
    { origin: 'London',  destination: 'Chennai',   airline: 'British Airways (direct)',     price: 680,  duration: '9h 10m',  stops: 'Direct',              label: 'Best Value' },
    { origin: 'London',  destination: 'Chennai',   airline: 'Air India (direct)',           price: 720,  duration: '9h 45m',  stops: 'Direct',              label: null },
    { origin: 'Dubai',   destination: 'Chennai',   airline: 'Air India Express (direct)',   price: 280,  duration: '3h 45m',  stops: 'Direct',              label: 'Best Value' },
    { origin: 'Dubai',   destination: 'Chennai',   airline: 'Indigo (direct)',              price: 310,  duration: '3h 50m',  stops: 'Direct',              label: null },
    { origin: 'Lagos',   destination: 'Delhi',     airline: 'Emirates (via Dubai)',         price: 920,  duration: '13h 10m', stops: '1 stop (Dubai)',      label: null },
    { origin: 'Lagos',   destination: 'Delhi',     airline: 'Ethiopian Airlines (via Addis)',price: 850,  duration: '15h 20m', stops: '1 stop (Addis Ababa)', label: 'Best Value' },
    { origin: 'Nairobi', destination: 'Delhi',     airline: 'Kenya Airways (via Nairobi)', price: 680,  duration: '7h 30m',  stops: 'Direct',              label: 'Best Value' },
    { origin: 'London',  destination: 'Delhi',     airline: 'British Airways (direct)',     price: 560,  duration: '8h 20m',  stops: 'Direct',              label: 'Best Value' },
    { origin: 'Lagos',   destination: 'Mumbai',    airline: 'Emirates (via Dubai)',         price: 900,  duration: '12h 50m', stops: '1 stop (Dubai)',      label: null },
    { origin: 'Lagos',   destination: 'Mumbai',    airline: 'Ethiopian Airlines (via Addis)',price: 810,  duration: '14h 40m', stops: '1 stop (Addis Ababa)', label: 'Best Value' },
    { origin: 'Lagos',   destination: 'Bangalore', airline: 'Emirates (via Dubai)',         price: 960,  duration: '13h 50m', stops: '1 stop (Dubai)',      label: null },
    { origin: 'Lagos',   destination: 'Bangalore', airline: 'Ethiopian Airlines (via Addis)',price: 840,  duration: '16h 10m', stops: '1 stop (Addis Ababa)', label: 'Best Value' },
  ]});

  // ── Insurance Plans ───────────────────────────────────────────────────────
  const insurancePlans = [
    { name: 'SafetyWing', tagline: 'Nomad Insurance', pricePerDay: 150, coverage: '$250,000 medical + emergency evacuation', features: ['Covers post-surgical complications abroad', 'Emergency evacuation included', '24/7 emergency helpline', 'Cashless at Apollo & JCI network hospitals', 'Pre-existing covered with rider'], recommended: true },
    { name: 'World Nomads', tagline: 'Explorer Plan', pricePerDay: 195, coverage: '$500,000 medical + trip cancellation', features: ['Covers elective surgery complications', 'Trip cancellation if medically unfit to travel', 'Direct billing at JCI hospitals', 'App-based claims', 'Adventure sports covered'], recommended: false },
    { name: 'Cigna Global Medical', tagline: 'Full-Year Coverage', pricePerDay: 320, coverage: '$1,000,000 lifetime medical', features: ['Pre-existing conditions covered', 'No per-trip limitation', 'Dental & vision add-ons available', 'Expat-grade coverage', 'Direct hospital billing worldwide'], recommended: false },
  ];

  for (const plan of insurancePlans) {
    await prisma.insurancePlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  // ── Recovery Protocols ────────────────────────────────────────────────────
  const recoveryProtocols = [
    {
      procedure: 'ACL Reconstruction',
      checkIns: [
        { day: 'Day 1–3', title: 'Immediate Post-Op', summary: 'Ice, elevation, and rest. Expect swelling. Pain is normal — managed with prescribed NSAIDs.', status: 'completed', doctorNote: 'Cryo-therapy 20 min every 2 hrs. Do not bear weight without crutches.' },
        { day: 'Day 4–7', title: 'Early Mobilisation', summary: 'Gentle range-of-motion exercises. Start quadriceps activation. Wound check by nursing team.', status: 'completed', doctorNote: 'Target 0–30° flexion by Day 5. Call if wound leaks or fever > 38°C.' },
        { day: 'Week 2–3', title: 'Outpatient Physio', summary: 'Daily physiotherapy sessions. Gait training with crutches. Stationary bike introduced.', status: 'active', doctorNote: 'Progress to full weight-bearing by Day 14 if pain allows.' },
        { day: 'Week 4–6', title: 'Strength Phase', summary: 'Progressive resistance training. Pool walking if available. Swelling should be minimal.', status: 'pending', doctorNote: null },
        { day: 'Week 8–12', title: 'Return to Activity', summary: 'Jogging, agility drills. Final MRI to confirm graft integration.', status: 'pending', doctorNote: null },
      ],
      tips: [
        { icon: '🧊', text: 'Ice 20 minutes every 2 hours for the first 72 hours — reduces swelling and pain medication need.' },
        { icon: '🦵', text: 'Keep the leg elevated above heart level when resting — gravity does the drainage work.' },
        { icon: '💊', text: 'Take anti-inflammatories with food. Do not skip doses — consistent blood levels matter.' },
        { icon: '🚶', text: 'Walk only with crutches until your physio clears you for weight bearing.' },
        { icon: '📱', text: 'Video-call your Curify care coordinator immediately if you notice unusual redness, heat, or discharge.' },
      ],
      handoff: { from: 'Dr. Rajesh Malhotra, Apollo Hospitals Chennai', to: 'Your local GP / physiotherapist', status: 'Sent', document: 'Discharge Summary + Operative Report + Physio Protocol', date: 'Available in your patient portal within 24 hrs of discharge' },
    },
    {
      procedure: 'Knee Replacement',
      checkIns: [
        { day: 'Day 1 post-op', title: 'Standing & First Steps', summary: 'Physio helps you stand and take first steps with walker. Pain managed. Swelling expected.', status: 'completed', doctorNote: 'Full weight bearing as tolerated. Use walker. Call if fever > 38.5°C.' },
        { day: 'Day 2–4', title: 'Stair Training', summary: 'Learning to navigate stairs safely with physiotherapist. Wound check daily.', status: 'completed', doctorNote: 'Target 90° flexion by Day 5. Ice after every physio session.' },
        { day: 'Week 2–3', title: 'Daily Physio Outpatient', summary: 'Strengthening quads and hamstrings. Walking without walker by Week 3 for most patients.', status: 'active', doctorNote: 'Progress to cane if walking is stable.' },
        { day: 'Week 4–6', title: 'Community Walking', summary: 'Short outdoor walks. Stationary bike. Driving cleared if right knee and automatic car.', status: 'pending', doctorNote: null },
        { day: 'Month 3–6', title: 'Full Recovery', summary: 'Return to normal activities. Swimming cleared. Most patients pain-free by 3 months.', status: 'pending', doctorNote: null },
      ],
      tips: [
        { icon: '🧊', text: 'Ice pack on knee for 20 minutes after every physio session — non-negotiable for swelling control.' },
        { icon: '🛌', text: 'Sleep with a pillow under your ankle (not under the knee) to keep the joint extended.' },
        { icon: '🚿', text: 'Keep wound dry until stitches/staples removed (usually Day 14). Use waterproof dressing for showering.' },
        { icon: '🚗', text: 'Do not drive for 6 weeks after right knee replacement. Inform your insurance company.' },
        { icon: '✈️', text: 'Wear compression stockings for all flights in the first 3 months. Walk the aisle every 2 hours.' },
      ],
      handoff: { from: 'Surgical Team, Apollo Hospitals Chennai', to: 'Your local orthopaedic surgeon + physiotherapist', status: 'Sent', document: 'Discharge Summary + Implant Card + 3-Month Physio Protocol', date: 'Available in patient portal within 24 hrs of discharge' },
    },
    {
      procedure: 'Cardiac Bypass Surgery',
      checkIns: [
        { day: 'Day 1–2 (ICU)', title: 'Critical Monitoring', summary: 'Extubation within 6–24 hrs. Cardiac monitoring. IV medications. Family updates every 4 hrs.', status: 'completed', doctorNote: 'Stable cardiac rhythm is priority. Pain managed via epidural or IV.' },
        { day: 'Day 3–5', title: 'Step-Down Ward', summary: 'Moved out of ICU. Oral medications start. Sitting up in chair. Short walks in ward.', status: 'completed', doctorNote: 'Monitor wound for infection. Sternal precautions for 6 weeks — no pushing/pulling.' },
        { day: 'Week 2–3', title: 'Cardiac Rehab Begins', summary: 'Supervised walking programme. Diet counselling. Medication review.', status: 'active', doctorNote: 'Target 10 minutes walking twice daily. Cardiac physio introduces exercise programme.' },
        { day: 'Week 4–6', title: 'Increasing Activity', summary: 'Walking 30 minutes daily. Stairs cleared. Return to sedentary work possible.', status: 'pending', doctorNote: null },
        { day: 'Month 3–6', title: 'Return to Normal Life', summary: 'Most activities resumed. Driving cleared at 6 weeks. Follow-up angiogram if needed.', status: 'pending', doctorNote: null },
      ],
      tips: [
        { icon: '💊', text: 'Take all cardiac medications exactly as prescribed — aspirin, statins, beta-blockers are essential for graft patency.' },
        { icon: '🫁', text: 'Deep breathing exercises 10 times per hour while awake — prevents post-cardiac surgery pneumonia.' },
        { icon: '🚶', text: 'Walk a little more each day. Cardiac rehab walking is the single best predictor of long-term outcomes.' },
        { icon: '🩺', text: 'Sternal precautions for 6 weeks — do not push, pull, or lift more than 5kg. Protect the healing sternum.' },
        { icon: '🥗', text: 'Heart-healthy diet — Mediterranean pattern. Limit sodium, saturated fat. No return to smoking ever.' },
      ],
      handoff: { from: 'Dr. Priya Nair, Fortis Memorial Research Institute', to: 'Your cardiologist + cardiac rehabilitation team', status: 'Sent', document: 'Discharge Summary + Operative Report + Medication List + Cardiac Rehab Protocol', date: 'Sent to your email and patient portal on discharge day' },
    },
  ];

  for (const protocol of recoveryProtocols) {
    await prisma.recoveryProtocol.upsert({
      where: { procedure: protocol.procedure },
      update: { checkIns: protocol.checkIns, tips: protocol.tips, handoff: protocol.handoff },
      create: protocol,
    });
  }

  console.log('✅ Seed complete — hospitals, surgeons, reviews, templates, flights, insurance, recovery protocols seeded.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
