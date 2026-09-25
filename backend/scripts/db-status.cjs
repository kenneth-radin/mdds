/* Prints document counts for every collection in the configured database.
   Usage: MONGODB_URI=... node backend/scripts/db-status.cjs */
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required.');
  process.exit(1);
}

mongoose
  .connect(uri)
  .then(async () => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const counts = {};
    for (const collection of collections) {
      counts[collection.name] = await db.collection(collection.name).countDocuments();
    }
    console.log(`database: ${db.databaseName}`);
    console.log(JSON.stringify(counts, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('ERROR', error.message);
    process.exit(1);
  });
