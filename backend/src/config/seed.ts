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
    name: 'HICON HZB-160F Ice Maker',
    machineType: 'Commercial Ice Maker',
    manufacturer: 'HICON',
    model: 'HZB-160F',
    serialNumber: 'SN-CMP-001',
    location: 'Utility Plant - Bay 1',
    criticality: 'medium',
    installationDate: new Date('2020-04-10'),
    ratedPowerKw: 0.75,
    ratedVoltage: 220,
    ratedCurrent: null,
    designSpeedRpm: null,
    ratedCapacity: null,
    capacityUnit: '',
    yearAcquired: 2020,
    operatingHours: 26800,
    lastMaintenanceDate: new Date('2026-06-15'),
    recommendedMaintenanceIntervalDays: 90,
    notes: 'HICON HZB-160F commercial ice maker (water-cooled).',
    createdBy: userId,
    iceShape: 'Block',
    control: 'Electric',
    powerW: 750,
    structure: 'Integral Type',
    material: 'Stainless Steel',
    application: 'Commercial',
    condensingMode: 'Water-Cooled',
    filteringDevice: true,
    autoCleaningDevice: true,
    netWeightKg: 37,
    grossWeightKg: 39,
    specification: '566x450x508mm',
    trademark: 'HICON/OEM',
    origin: 'China, Ningbo'
  });

  console.log('[seed] created default compressor CMP-001 (_id: %s)', doc._id.toHexString());
  return doc._id.toHexString();
}
