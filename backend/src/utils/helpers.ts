import { Types, HydratedDocument } from 'mongoose';
import { Machine, IMachine } from '../models/Machine';
import { HttpError } from '../middleware/error';

export async function resolveMachine(machineId: string): Promise<HydratedDocument<IMachine>> {
  const byObjectId = Types.ObjectId.isValid(machineId) ? machineId : null;
  const machine = await Machine.findOne(
    byObjectId ? { $or: [{ _id: byObjectId }, { machineId }] } : { machineId }
  );
  if (!machine) throw new HttpError(404, 'Machine not found.');
  return machine;
}

export function buildCaseNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `MC-${year}-${String(sequence).padStart(4, '0')}`;
}

export function normalizeTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'was', 'were', 'are', 'has', 'have',
  'not', 'but', 'after', 'before', 'when', 'while', 'its', 'it', 'on', 'in', 'of', 'to',
  'a', 'an', 'is', 'be', 'been', 'at', 'by', 'as', 'or', 'machine', 'motor', 'unit'
]);

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
