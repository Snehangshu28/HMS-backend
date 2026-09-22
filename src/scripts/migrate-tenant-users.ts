/**
 * Safe migration for users missing hospitalId (tenant).
 *
 * Dry-run by default. Only assigns orphan non–Super Admin users when there is
 * exactly ONE hospital in the database (unambiguous tenant).
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/migrate-tenant-users.ts
 *   npx ts-node --transpile-only src/scripts/migrate-tenant-users.ts --apply
 */
import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../modules/auth/user.model';
import { Hospital } from '../modules/auth/hospital.model';

const apply = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(config.mongoUri, config.dbName ? { dbName: config.dbName } : undefined);

  const orphans = await User.find({
    $or: [{ hospitalId: null }, { hospitalId: { $exists: false } }],
    role: { $ne: 'Super Admin' },
    isDeleted: false,
  }).select('email role name isActive');

  const hospitals = await Hospital.find({ isActive: true }).select('name subdomain');

  console.log(`Found ${orphans.length} user(s) without hospitalId (excluding Super Admin).`);
  console.log(`Found ${hospitals.length} active hospital(s).`);

  if (!orphans.length) {
    console.log('Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  orphans.forEach((u) => {
    console.log(`  - ${u.email} (${u.role}) active=${u.isActive}`);
  });

  if (hospitals.length !== 1) {
    console.log(
      '\nRefusing automatic assignment: need exactly one active hospital to safely attach orphans.'
    );
    console.log('Create/repair tenants manually, then re-run if needed.');
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  const hospital = hospitals[0];
  console.log(`\nCandidate tenant: ${hospital.name} (${hospital.subdomain}) [${hospital._id}]`);

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to attach these users to that hospital.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(
    {
      _id: { $in: orphans.map((u) => u._id) },
      $or: [{ hospitalId: null }, { hospitalId: { $exists: false } }],
      role: { $ne: 'Super Admin' },
    },
    { $set: { hospitalId: hospital._id } }
  );

  console.log(`Updated ${result.modifiedCount} user(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
