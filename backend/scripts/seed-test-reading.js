require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const MACHINE_ID = '6ae6eec933d5cddf205fff4c'; // Machine CMP-001 _id from production DB

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const db = mongoose.connection.db;
  const result = await db.collection('sensorreadings').insertOne({
    machine: new mongoose.Types.ObjectId(MACHINE_ID),
    temperature: 72.5,
    vibration: 3.2,
    voltage: 220,
    current: 12,
    operatingHours: 150,
    timestamp: new Date().toISOString(),
    source: 'simulated',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('Inserted SensorReading _id:', result.insertedId);
  console.log('temperature: 72.5, vibration: 3.2, source: test');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Insert failed:', error);
  process.exit(1);
});
