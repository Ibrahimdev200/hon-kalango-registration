// Usage: node scripts/set-admin.js
// Requires firebase credentials (firebase-key.json or FIREBASE_SERVICE_ACCOUNT env var)

const db = require('../server/database');

async function main() {
  try {
    await db.initializeDB();
  } catch (err) {
    console.error('Failed to initialize DB:', err.message || err);
    process.exit(1);
  }

  const username = process.env.NEW_ADMIN_USERNAME || process.env.ADMIN_USERNAME;
  const password = process.env.NEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Please set NEW_ADMIN_USERNAME and NEW_ADMIN_PASSWORD env vars or ADMIN_USERNAME/ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  const password_hash = db.hashPassword(password);
  try {
    const result = await db.setAdminConfig({ username, password_hash });
    console.log('Admin config saved to DB:', result);
    process.exit(0);
  } catch (err) {
    console.error('Failed to save admin config:', err.message || err);
    process.exit(1);
  }
}

main();
