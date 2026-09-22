/**
 * Seeds CareFlow HMS with a demo hospital, staff, patients, OPD queue, IPD beds, and invoices.
 * Usage: npx ts-node --transpile-only src/scripts/seed.ts
 * Safe to re-run: clears only the demo hospital subdomain "careflow" then recreates.
 */
import mongoose from 'mongoose';
import { config } from '../config';
import { Hospital } from '../modules/auth/hospital.model';
import { User } from '../modules/auth/user.model';
import { Patient, PatientHistory } from '../modules/patients/models';
import { Doctor, DoctorSchedule } from '../modules/doctors/models';
import { Appointment, Queue } from '../modules/appointments/models';
import { Ward, Bed, Admission } from '../modules/ipd/models';
import { Invoice } from '../modules/billing/models';

const SUBDOMAIN = 'careflow';
const PASSWORD = 'password';

async function clearDemo(hospitalId: mongoose.Types.ObjectId) {
  await Promise.all([
    User.deleteMany({ hospitalId }),
    Patient.deleteMany({ hospitalId }),
    PatientHistory.deleteMany({ hospitalId }),
    Doctor.deleteMany({ hospitalId }),
    DoctorSchedule.deleteMany({ hospitalId }),
    Appointment.deleteMany({ hospitalId }),
    Queue.deleteMany({ hospitalId }),
    Ward.deleteMany({ hospitalId }),
    Bed.deleteMany({ hospitalId }),
    Admission.deleteMany({ hospitalId }),
    Invoice.deleteMany({ hospitalId }),
  ]);
}

async function seed() {
  console.log('Connecting to', config.mongoUri, config.dbName ? `(dbName=${config.dbName})` : '');
  await mongoose.connect(config.mongoUri, config.dbName ? { dbName: config.dbName } : undefined);
  console.log('Connected:', mongoose.connection.name);

  let hospital = await Hospital.findOne({ subdomain: SUBDOMAIN });
  if (hospital) {
    console.log('Resetting existing demo hospital…');
    await clearDemo(hospital._id as mongoose.Types.ObjectId);
  } else {
    hospital = await Hospital.create({
      name: 'CareFlow General Hospital',
      subdomain: SUBDOMAIN,
      address: { street: '12 Health Avenue', city: 'Kolkata', state: 'WB', zip: '700001' },
      contact: { email: 'admin@hospital.com', phone: '+91-9876500000' },
      subscription: { plan: 'Pro', status: 'Active' },
      isActive: true,
    });
  }

  const hid = hospital._id as mongoose.Types.ObjectId;

  const staffSpecs: { email: string; role: any; first: string; last: string; phone: string }[] = [
    { email: 'admin@hospital.com', role: 'Hospital Admin', first: 'Ananya', last: 'Sen', phone: '9876500001' },
    { email: 'doctor@hospital.com', role: 'Doctor', first: 'Rohan', last: 'Mehta', phone: '9876500002' },
    { email: 'doctor2@hospital.com', role: 'Doctor', first: 'Priya', last: 'Das', phone: '9876500003' },
    { email: 'receptionist@hospital.com', role: 'Receptionist', first: 'Kabir', last: 'Roy', phone: '9876500004' },
    { email: 'nurse@hospital.com', role: 'Nurse', first: 'Meera', last: 'Nair', phone: '9876500005' },
    { email: 'lab@hospital.com', role: 'Lab Technician', first: 'Arjun', last: 'Ghosh', phone: '9876500006' },
    { email: 'pharmacist@hospital.com', role: 'Pharmacist', first: 'Sana', last: 'Khan', phone: '9876500007' },
    { email: 'accountant@hospital.com', role: 'Accountant', first: 'Dev', last: 'Banerjee', phone: '9876500008' },
  ];

  const users: Record<string, any> = {};
  for (const s of staffSpecs) {
    users[s.email] = await User.create({
      hospitalId: hid,
      email: s.email,
      passwordHash: PASSWORD,
      role: s.role,
      name: { first: s.first, last: s.last },
      phone: s.phone,
      isActive: true,
    });
  }

  const doctorUser = users['doctor@hospital.com'];
  const doctor2User = users['doctor2@hospital.com'];

  const doctor = await Doctor.create({
    hospitalId: hid,
    userId: doctorUser._id,
    licenseNumber: 'MCI-WB-45821',
    specialization: ['General Medicine', 'Internal Medicine'],
    qualification: ['MBBS', 'MD'],
    experienceYears: 12,
    consultationFee: 600,
    isAvailable: true,
  });

  const doctor2 = await Doctor.create({
    hospitalId: hid,
    userId: doctor2User._id,
    licenseNumber: 'MCI-WB-55210',
    specialization: ['Pediatrics'],
    qualification: ['MBBS', 'DCH'],
    experienceYears: 8,
    consultationFee: 500,
    isAvailable: true,
  });

  for (const d of [doctor, doctor2]) {
    await DoctorSchedule.create({
      hospitalId: hid,
      doctorId: d._id,
      weeklySlots: [
        { dayOfWeek: 'Monday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
        { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
        { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
        { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
        { dayOfWeek: 'Friday', startTime: '09:00', endTime: '13:00', slotDuration: 15 },
        { dayOfWeek: 'Saturday', startTime: '10:00', endTime: '13:00', slotDuration: 15 },
      ],
      exceptions: [],
    });
  }

  const patientData = [
    { first: 'Aisha', last: 'Sharma', gender: 'Female' as const, phone: '9001000001', blood: 'B+', city: 'Kolkata' },
    { first: 'Vikram', last: 'Patel', gender: 'Male' as const, phone: '9001000002', blood: 'O+', city: 'Howrah' },
    { first: 'Nisha', last: 'Banerjee', gender: 'Female' as const, phone: '9001000003', blood: 'A+', city: 'Kolkata' },
    { first: 'Rahul', last: 'Singh', gender: 'Male' as const, phone: '9001000004', blood: 'AB+', city: 'Salt Lake' },
    { first: 'Fatima', last: 'Ali', gender: 'Female' as const, phone: '9001000005', blood: 'O-', city: 'Kolkata' },
    { first: 'Aryan', last: 'Mukherjee', gender: 'Male' as const, phone: '9001000006', blood: 'B-', city: 'Dum Dum' },
  ];

  const patients = [];
  for (const p of patientData) {
    const patient = await Patient.create({
      hospitalId: hid,
      name: { first: p.first, last: p.last },
      dateOfBirth: new Date(1990 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), 10),
      gender: p.gender,
      contact: { phone: p.phone, email: `${p.first.toLowerCase()}@email.com` },
      address: { city: p.city, state: 'WB' },
      emergencyContact: { name: 'Family', relationship: 'Spouse', phone: '9001999999' },
      bloodGroup: p.blood,
    });
    await PatientHistory.create({
      hospitalId: hid,
      patientId: patient._id,
      allergies: p.first === 'Aisha' ? [{ allergen: 'Penicillin', severity: 'High', reaction: 'Rash' }] : [],
      chronicConditions: p.first === 'Vikram' ? ['Hypertension'] : [],
      surgicalHistory: [],
      familyHistory: [],
    });
    patients.push(patient);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slots = [
    { start: '09:00', end: '09:15' },
    { start: '09:15', end: '09:30' },
    { start: '09:30', end: '09:45' },
    { start: '10:00', end: '10:15' },
  ];

  const appointments = [];
  for (let i = 0; i < 4; i++) {
    const appt = await Appointment.create({
      hospitalId: hid,
      patientId: patients[i]._id,
      doctorId: doctor._id,
      scheduledDate: today,
      startTime: slots[i].start,
      endTime: slots[i].end,
      type: 'OPD',
      status: i === 0 ? 'In-Progress' : 'Scheduled',
      notes: i === 2 ? 'Follow-up BP check' : undefined,
    });
    appointments.push(appt);
  }

  await Queue.create({
    hospitalId: hid,
    doctorId: doctor._id,
    date: today,
    activeQueue: appointments.map((a, idx) => ({
      appointmentId: a._id,
      patientId: a.patientId,
      tokenNumber: idx + 1,
      status: idx === 0 ? 'In-Consultation' : 'Waiting',
    })),
  });

  const general = await Ward.create({ hospitalId: hid, name: 'General Ward A', category: 'General', capacity: 8 });
  const icu = await Ward.create({ hospitalId: hid, name: 'ICU-1', category: 'ICU', capacity: 4 });

  const beds: any[] = [];
  for (let i = 1; i <= 6; i++) {
    beds.push(
      await Bed.create({
        hospitalId: hid,
        wardId: general._id,
        bedNumber: `GA-${i}`,
        type: i <= 2 ? 'Private' : 'General',
        status: i <= 2 ? 'Occupied' : 'Available',
      })
    );
  }
  for (let i = 1; i <= 4; i++) {
    beds.push(
      await Bed.create({
        hospitalId: hid,
        wardId: icu._id,
        bedNumber: `ICU-${i}`,
        type: 'ICU',
        status: i === 1 ? 'Occupied' : i === 4 ? 'Maintenance' : 'Available',
      })
    );
  }

  await Admission.create({
    hospitalId: hid,
    patientId: patients[4]._id,
    admittedBy: doctor._id,
    reason: 'Acute asthma exacerbation',
    wardId: general._id,
    bedId: beds[0]._id,
    primaryNurse: users['nurse@hospital.com']._id,
    status: 'Admitted',
  });

  await Admission.create({
    hospitalId: hid,
    patientId: patients[5]._id,
    admittedBy: doctor._id,
    reason: 'Post-op monitoring',
    wardId: icu._id,
    bedId: beds[6]._id,
    primaryNurse: users['nurse@hospital.com']._id,
    status: 'Admitted',
  });

  const due = new Date();
  due.setDate(due.getDate() + 3);

  await Invoice.create({
    hospitalId: hid,
    patientId: patients[0]._id,
    items: [
      {
        description: 'OPD Consultation — General Medicine',
        category: 'Consultation',
        quantity: 1,
        unitPrice: 600,
        taxRate: 0,
        taxAmount: 0,
        totalPrice: 600,
      },
    ],
    subtotal: 600,
    taxTotal: 0,
    discountAmount: 0,
    grandTotal: 600,
    paymentStatus: 'Unpaid',
    dueDate: due,
  });

  await Invoice.create({
    hospitalId: hid,
    patientId: patients[1]._id,
    items: [
      {
        description: 'OPD Consultation',
        category: 'Consultation',
        quantity: 1,
        unitPrice: 600,
        taxRate: 0,
        taxAmount: 0,
        totalPrice: 600,
      },
      {
        description: 'CBC Lab Panel',
        category: 'Lab Test',
        quantity: 1,
        unitPrice: 450,
        taxRate: 0,
        taxAmount: 0,
        totalPrice: 450,
      },
    ],
    subtotal: 1050,
    taxTotal: 0,
    discountAmount: 50,
    grandTotal: 1000,
    paymentStatus: 'Paid',
    dueDate: due,
  });

  console.log('\n✅ Seed complete for CareFlow General Hospital');
  console.log('Database:', mongoose.connection.name);
  console.log('Login with password "password":');
  staffSpecs.forEach((s) => console.log(`  ${s.role.padEnd(16)} ${s.email}`));
  console.log(`\nPatients: ${patients.length} | Doctors: 2 | Beds: ${beds.length} | Today OPD tokens: 4`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
