const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let db;
let usingAdminSDK = false;
let adminInstance;

// Helper for hashing sensitive fields
function hashValue(value) {
  if (!value) return '';
  const normalized = value.toString().replace(/\s+/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Helper for masking values for UI
function maskValue(value, showLength = 2) {
  if (!value) return '';
  const str = value.toString().replace(/\s+/g, '');
  if (str.length <= showLength * 2) {
    return '*'.repeat(str.length);
  }
  return str.slice(0, showLength) + '*'.repeat(str.length - showLength * 2) + str.slice(-showLength);
}

// Initialize / test database connection
async function initializeDB() {
  console.log('[Firebase] Initializing database connection...');

  const keyPath = path.resolve(__dirname, '../firebase-key.json');

  // Case A: Initialize using Firebase Admin SDK (Recommended)
  if (fs.existsSync(keyPath)) {
    try {
      const admin = require('firebase-admin');
      const serviceAccount = require(keyPath);
      adminInstance = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = admin.firestore();
      usingAdminSDK = true;
      console.log('[Firebase] Admin SDK initialized successfully with firebase-key.json.');
      
      // Test the connection
      await db.collection('registrations').limit(1).get();
      console.log('[Firebase] Cloud Firestore connection validated.');
      return;
    } catch (err) {
      console.warn('[Firebase Warning] Failed to initialize Admin SDK with key file:', err.message);
    }
  }

  // Case B: Fallback to Firebase client Web SDK (uses config from .env)
  console.log('[Firebase] Falling back to Web Client SDK credentials...');
  try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, limit, getDocs, query } = require('firebase/firestore');

    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    usingAdminSDK = false;
    
    // Test connection
    const q = query(collection(db, 'registrations'), limit(1));
    await getDocs(q);
    console.log('[Firebase] Web Client SDK connection validated successfully.');
  } catch (err) {
    console.error('\n======================================================================');
    console.error('❌  [Firebase Initialization Error] Connection failed!');
    console.error('Error Details:', err.message);
    console.error('\nPOSSIBLE SOLUTIONS TO RUN CLOUD BACKEND:');
    console.error('Option A (Recommended - Secure Admin Mode):');
    console.error('  1. Go to Firebase Console -> Project Settings -> Service Accounts.');
    console.error('  2. Click "Generate New Private Key" and download the JSON file.');
    console.error('  3. Rename it to "firebase-key.json" and place it in the project root:');
    console.error(`     ${path.resolve(__dirname, '../firebase-key.json')}`);
    console.error('Option B (Public Client Mode):');
    console.error('  1. Go to Firebase Console -> Firestore Database -> Rules.');
    console.error('  2. Set rules to allow read/write (e.g., allow read, write: if true; for testing).');
    console.error('======================================================================\n');
    throw err;
  }
}

// Check duplicates
async function checkPVCExists(pvc) {
  const hash = hashValue(pvc);
  if (usingAdminSDK) {
    const snapshot = await db.collection('registrations')
      .where('pvc_hash', '==', hash)
      .limit(1)
      .get();
    return !snapshot.empty;
  } else {
    const { query, collection, where, limit, getDocs } = require('firebase/firestore');
    const q = query(collection(db, 'registrations'), where('pvc_hash', '==', hash), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }
}

async function checkAccountExists(accountNum) {
  const hash = hashValue(accountNum);
  if (usingAdminSDK) {
    const snapshot = await db.collection('registrations')
      .where('account_num_hash', '==', hash)
      .limit(1)
      .get();
    return !snapshot.empty;
  } else {
    const { query, collection, where, limit, getDocs } = require('firebase/firestore');
    const q = query(collection(db, 'registrations'), where('account_num_hash', '==', hash), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }
}

// Log duplicate attempt
async function logDuplicateAttempt(data) {
  const { form_type, full_name, phone_number, pvc, account_number, ip_address, attempt_reason } = data;
  const pvc_masked = pvc ? maskValue(pvc, 3) : '';
  const account_num_masked = account_number ? maskValue(account_number, 3) : '';
  const timestamp = new Date().toISOString();

  const docData = {
    form_type,
    full_name,
    phone_number,
    pvc_masked,
    account_num_masked,
    ip_address,
    timestamp,
    attempt_reason
  };

  if (usingAdminSDK) {
    await db.collection('duplicate_attempts').add(docData);
  } else {
    const { collection, addDoc } = require('firebase/firestore');
    await addDoc(collection(db, 'duplicate_attempts'), docData);
  }
}

// Generate unique Member ID
async function generateMemberID(formType, gender) {
  let prefix = 'KMK-W-'; // Default Ward
  let count = 0;

  if (usingAdminSDK) {
    let q = db.collection('registrations');
    if (formType === 'ward') {
      q = q.where('form_type', '==', 'ward');
    } else {
      if (gender === 'Male') {
        prefix = 'KMK-B-'; // Boys
        q = q.where('form_type', '==', 'youth_women').where('gender', '==', 'Male');
      } else {
        prefix = 'KMK-L-'; // Ladies
        q = q.where('form_type', '==', 'youth_women').where('gender', '==', 'Female');
      }
    }
    const snapshot = await q.count().get();
    count = snapshot.data().count;
  } else {
    const { query, collection, where, getCountFromServer } = require('firebase/firestore');
    let q = collection(db, 'registrations');
    if (formType === 'ward') {
      q = query(q, where('form_type', '==', 'ward'));
    } else {
      if (gender === 'Male') {
        prefix = 'KMK-B-';
        q = query(q, where('form_type', '==', 'youth_women'), where('gender', '==', 'Male'));
      } else {
        prefix = 'KMK-L-';
        q = query(q, where('form_type', '==', 'youth_women'), where('gender', '==', 'Female'));
      }
    }
    const snapshot = await getCountFromServer(q);
    count = snapshot.data().count;
  }

  const nextNum = count + 1;
  const padded = String(nextNum).padStart(5, '0');
  return `${prefix}${padded}`;
}

// Create a new registration
async function createRegistration(data) {
  // Check duplicates first
  const pvcExists = await checkPVCExists(data.pvc);
  if (pvcExists) {
    throw new Error('PVC_DUPLICATE');
  }

  const accountExists = await checkAccountExists(data.account_number);
  if (accountExists) {
    throw new Error('ACCOUNT_DUPLICATE');
  }

  const memberId = await generateMemberID(data.form_type, data.gender);
  const pvc_hash = hashValue(data.pvc);
  const pvc_masked = maskValue(data.pvc, 3);
  const account_num_hash = hashValue(data.account_number);
  const account_num_masked = maskValue(data.account_number, 3);
  const timestamp = new Date().toISOString();
  
  const referrals = data.referral_names || [];

  const docData = {
    member_id: memberId,
    form_type: data.form_type,
    full_name: data.full_name,
    phone_number: data.phone_number,
    email: data.email || null,
    gender: data.gender,
    dob: data.dob,
    ward: data.ward,
    community: data.community,
    polling_unit: data.polling_unit || null,
    employment_status: data.employment_status || null,
    occupation: data.occupation || null,
    skill_interest: data.skill_interest || null,
    education_level: data.education_level || null,
    pvc_hash,
    pvc_masked,
    bank_name: data.bank_name,
    account_num_hash,
    account_num_masked,
    account_name: data.account_name,
    referrer_name: data.referrer_name || null,
    referrer_phone: data.referrer_phone || null,
    bringing_count: Number(data.bringing_count || 5),
    referral_names: referrals,
    is_verified: 0,
    ip_address: data.ip_address,
    timestamp
  };

  let docId = '';
  if (usingAdminSDK) {
    const docRef = await db.collection('registrations').add(docData);
    docId = docRef.id;
  } else {
    const { collection, addDoc } = require('firebase/firestore');
    const docRef = await addDoc(collection(db, 'registrations'), docData);
    docId = docRef.id;
  }

  return { id: docId, member_id: memberId };
}

// Fetch all registrations (with in-memory search and filter)
async function getRegistrations(params = {}) {
  const { search, ward, verified, form_type } = params;
  let list = [];

  if (usingAdminSDK) {
    const snapshot = await db.collection('registrations').orderBy('timestamp', 'desc').get();
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  } else {
    const { query, collection, orderBy, getDocs } = require('firebase/firestore');
    const q = query(collection(db, 'registrations'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  }

  // Apply filters in-memory
  if (search) {
    const term = search.toLowerCase();
    list = list.filter(r => 
      (r.full_name && r.full_name.toLowerCase().includes(term)) ||
      (r.phone_number && r.phone_number.toLowerCase().includes(term)) ||
      (r.member_id && r.member_id.toLowerCase().includes(term))
    );
  }

  if (ward) {
    list = list.filter(r => r.ward === ward);
  }

  if (verified !== undefined && verified !== '') {
    const verifiedBool = verified === 'true' || verified === 1 || verified === true;
    list = list.filter(r => (r.is_verified === 1 || r.is_verified === true) === verifiedBool);
  }

  if (form_type) {
    if (form_type === 'boys') {
      list = list.filter(r => r.form_type === 'youth_women' && r.gender === 'Male');
    } else if (form_type === 'ladies') {
      list = list.filter(r => r.form_type === 'youth_women' && r.gender === 'Female');
    } else {
      list = list.filter(r => r.form_type === form_type);
    }
  }

  return list;
}

// Get aggregate stats
async function getStats() {
  let list = [];
  if (usingAdminSDK) {
    const snapshot = await db.collection('registrations').get();
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
  } else {
    const { collection, getDocs } = require('firebase/firestore');
    const snapshot = await getDocs(collection(db, 'registrations'));
    snapshot.forEach(doc => {
      list.push(doc.data());
    });
  }

  const stats = {
    total_members: 0,
    ward_members: 0,
    boys: 0,
    ladies: 0,
    ward_distribution: {},
  };

  list.forEach(data => {
    stats.total_members++;
    
    if (data.form_type === 'ward') {
      stats.ward_members++;
    } else if (data.form_type === 'youth_women') {
      if (data.gender === 'Male') {
        stats.boys++;
      } else {
        stats.ladies++;
      }
    }

    const ward = data.ward || 'Unknown';
    if (!stats.ward_distribution[ward]) {
      stats.ward_distribution[ward] = 0;
    }
    stats.ward_distribution[ward]++;
  });

  return stats;
}

// Fetch duplicate attempts logs
async function getDuplicateAttempts() {
  const list = [];
  if (usingAdminSDK) {
    const snapshot = await db.collection('duplicate_attempts').orderBy('timestamp', 'desc').get();
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  } else {
    const { query, collection, orderBy, getDocs } = require('firebase/firestore');
    const q = query(collection(db, 'duplicate_attempts'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  }
  return list;
}

// Verify a member
async function verifyMember(id, isVerified) {
  if (usingAdminSDK) {
    const docRef = db.collection('registrations').doc(id);
    await docRef.update({ is_verified: isVerified ? 1 : 0 });
  } else {
    const { doc, updateDoc } = require('firebase/firestore');
    const docRef = doc(db, 'registrations', id);
    await docRef.update({ is_verified: isVerified ? 1 : 0 });
  }
  return true;
}

// Fetch referral connections
async function getReferralNetwork() {
  const list = [];
  if (usingAdminSDK) {
    const snapshot = await db.collection('registrations').get();
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  } else {
    const { collection, getDocs } = require('firebase/firestore');
    const snapshot = await getDocs(collection(db, 'registrations'));
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
  }
  return list;
}

module.exports = {
  initializeDB,
  checkPVCExists,
  checkAccountExists,
  createRegistration,
  logDuplicateAttempt,
  getRegistrations,
  getStats,
  getDuplicateAttempts,
  verifyMember,
  getReferralNetwork,
  hashValue
};
