let admin;
try {
  admin = require("../firebase-admin");
} catch {
  // firebase-admin is not installed; Firebase sync is unavailable.
  admin = { initialized: false, db: null };
}
const mongoose = require("mongoose");
const SensorReading = require("../models/SensorReading");

// Sync latest reading to Firebase Realtime DB
async function syncLatestReading() {
  if (!admin.initialized) {
    console.log('[sync] Firebase not configured; skipping syncLatestReading');
    return;
  }
  try {
    const latest = await SensorReading.findOne({})
      .sort({ date: -1 })
      .lean();
    
    if (latest) {
      const ref = admin.db.ref("sensorReadings");
      ref.push({
        temperature: latest.temperature,
        vibration: latest.vibration,
        timestamp: latest.date.toISOString(),
        equipmentId: "CMP-001",
        source: "mongodb"
      });
      console.log("Synced to Firebase:", latest.temperature);
    }
  } catch (error) {
    console.error("Sync error:", error);
  }
}

// Sync all recent readings (last 24 hours)
async function syncRecentReadings() {
  if (!admin.initialized) {
    console.log('[sync] Firebase not configured; skipping syncRecentReadings');
    return;
  }
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const readings = await SensorReading.find({ date: { $gte: twentyFourHoursAgo } })
      .sort({ date: -1 });
    
    const ref = admin.db.ref("sensorReadingsHistory");
    
    for (const reading of readings) {
      await ref.push({
        temperature: reading.temperature,
        vibration: reading.vibration,
        timestamp: reading.date.toISOString(),
        equipmentId: "CMP-001",
        source: "mongodb"
      });
    }
    console.log(`Synced ${readings.length} readings to Firebase`);
  } catch (error) {
    console.error("Sync error:", error);
  }
}

// Start auto-sync every 30 seconds
setInterval(syncLatestReading, 30000);
setInterval(syncRecentReadings, 300000); // Every 5 minutes

module.exports = { syncLatestReading, syncRecentReadings };