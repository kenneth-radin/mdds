import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Machine } from '../models/Machine';

const DEFAULT_USER = {
  name: 'System Administrator',
  email: 'admin@plant.local',
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  title: 'Plant Administrator'
};

/** Seed the single fixed compressor (and its attribution user) if the DB is empty. */
export async function ensureDefaultUser(): Promise<string> {
  const existing = await User.findOne().lean();
  if (existing) return existing._id.toHexString();

  const hash = await bcrypt.hash(DEFAULT_USER.password, 10);
  const doc = await User.create({ ...DEFAULT_USER, passwordHash: hash });
  return doc._id.toHexString();
}

export async function ensureDefaultMachine(): Promise<string> {
  const hasMachine = (await Machine.countDocuments()) > 0;
  if (hasMachine) {
    const existing = await Machine.findOne().lean();
    return existing?._id.toHexString() ?? '';
  }

  const userId = await ensureDefaultUser();
  const doc = await Machine.create({
    machineId: 'CMP-001',
    name: 'Main Compressor',
    machineType: 'Screw Compressor',
    manufacturer: 'VTX Compressors',
    model: 'SC-7200',
    serialNumber: 'SN-CMP-001',
    location: 'Utility Plant - Bay 1',
    criticality: 'medium',
    installationDate: new Date('2020-04-10'),
    ratedPowerKw: 8.5,
    ratedVoltage: 415,
    ratedCurrent: 16,
    designSpeedRpm: 3000,
    ratedCapacity: 50,
    capacityUnit: 'kg',
    yearAcquired: 2020,
    operatingHours: 26800,
    lastMaintenanceDate: new Date('2026-06-15'),
    recommendedMaintenanceIntervalDays: 90,
    notes: 'Single fixed compressor for this facility.',
    createdBy: userId
  });

  console.log('[seed] created default compressor CMP-001 (_id: %s)', doc._id.toHexString());
  return doc._id.toHexString();
}
