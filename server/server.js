require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup session constants
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '@dherinosha2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@korede2026';
const SESSION_COOKIE = 'hon_kalango_session';
const SESSION_USER_COOKIE = 'hon_kalango_user';
const SESSION_SECRET = 'kalango_secret_session_key_2027';

function generateSessionToken(username, secret) {
  return crypto.createHash('sha256').update(`${username}:${secret}:${SESSION_SECRET}`).digest('hex');
}

function getAdminSessionToken() {
  return generateSessionToken(ADMIN_USERNAME.toString().trim().toLowerCase(), ADMIN_PASSWORD);
}

app.use(express.json());
app.use(cookieParser());

// Support Netlify function path rewriting and CORS preflight for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/.netlify/functions/api/')) {
    req.url = req.url.replace(/^\.\/netlify\/functions\/api/, '/api');
    req.path = req.path.replace(/^\.\/netlify\/functions\/api/, '/api');
  }

  if (req.method === 'OPTIONS' && req.path.startsWith('/api/')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }

  next();
});

// Diagnostic route to check backend environment and database status
app.get('/api/diagnose', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const keyPath = path.resolve(__dirname, '../firebase-key.json');
  
  const status = db.getDBStatus();
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      has_FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      has_FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      has_FIREBASE_API_KEY: !!process.env.FIREBASE_API_KEY,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'Not Set'
    },
    files: {
      has_firebase_key_json: fs.existsSync(keyPath)
    },
    databaseState: {
      dbInitialized,
      ...status
    }
  };

  try {
    await db.initializeDB();
    diagnostics.connectionTest = 'Success';
  } catch (err) {
    diagnostics.connectionTest = 'Failed';
    diagnostics.error = err.message;
  }

  return res.json(diagnostics);
});

// Lazy Database Initialization Middleware for Serverless
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await db.initializeDB();
      dbInitialized = true;
    } catch (err) {
      console.error('Database lazy init failed:', err);
      return res.status(500).json({ error: 'Database connection failed: ' + err.message });
    }
  }
  next();
});

// Serve static files from root directory (merged project layout)
app.use(express.static(path.join(__dirname, '..')));

// Middleware to check authentication
async function authorizeAdmin(req, res, next) {
  const sessionToken = req.cookies[SESSION_COOKIE];
  const sessionUser = req.cookies[SESSION_USER_COOKIE];

  if (!sessionToken || !sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adminUsernameNormalized = ADMIN_USERNAME.toString().trim().toLowerCase();
  if ((sessionUser === adminUsernameNormalized || sessionUser === 'admin') && sessionToken === getAdminSessionToken()) {
    req.authUser = {
      username: 'admin',
      role: 'admin',
      permissions: ['view_registrations', 'edit_users', 'view_duplicates', 'view_referrals', 'export_csv', 'manage_subadmins']
    };
    return next();
  }

  try {
    const subadmin = await db.getSubadminByUsername(sessionUser);
    if (!subadmin || !subadmin.active) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const expectedToken = generateSessionToken(subadmin.username, subadmin.password_hash);
    if (sessionToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.authUser = {
      username: subadmin.username,
      role: 'subadmin',
      permissions: subadmin.permissions || []
    };
    return next();
  } catch (err) {
    console.error('Subadmin auth failure:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function hasPermission(req, permission) {
  if (!req.authUser) return false;
  return req.authUser.role === 'admin' || req.authUser.permissions.includes(permission);
}

// Client IP retrieval helper
function getClientIp(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  // Normalize IPv6 local loopback to IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return ip;
}

// API Routes

// 1. Check duplicate on blur
app.get('/api/check-duplicate', async (req, res) => {
  try {
    const { pvc, account_number } = req.query;

    if (pvc) {
      const exists = await db.checkPVCExists(pvc);
      return res.json({ exists, field: 'pvc' });
    }

    if (account_number) {
      const exists = await db.checkAccountExists(account_number);
      return res.json({ exists, field: 'account_number' });
    }

    return res.status(400).json({ error: 'Missing query parameters' });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Submit Registration
app.post('/api/register', async (req, res) => {
  const ip_address = getClientIp(req);
  const data = { ...req.body, ip_address };

  // Validate required fields
  const requiredFields = [
    'form_type', 'full_name', 'phone_number', 'gender', 'dob',
    'ward', 'pvc', 'bank_name', 'account_number', 'account_name'
  ];

  for (const field of requiredFields) {
    if (!data[field]) {
      return res.status(400).json({ error: `Field '${field}' is required.` });
    }
  }

  // Ward specific fields
  if (data.form_type === 'ward') {
    if (!data.bringing_count || parseInt(data.bringing_count) < 1) {
      return res.status(400).json({ error: "Please enter a valid household member count." });
    }
  }

  // Youth/Women specific fields
  if (data.form_type === 'youth_women') {
    if (!data.employment_status || !data.education_level) {
      return res.status(400).json({ error: "Employment status and educational level are required." });
    }
  }

  // Ensure referral_names is an array (making it optional)
  if (!data.referral_names || !Array.isArray(data.referral_names)) {
    data.referral_names = [];
  }

  // Phone number format validation (basic check)
  const phonePattern = /^(?:\+234|0)[789]\d{9}$/;
  if (!phonePattern.test(data.phone_number.replace(/\s+/g, ''))) {
    return res.status(400).json({ error: "Invalid Nigerian phone number format." });
  }

  // Account number format validation (10 digits)
  const accountPattern = /^\d{10}$/;
  if (!accountPattern.test(data.account_number.replace(/\s+/g, ''))) {
    return res.status(400).json({ error: "Bank account number must be exactly 10 digits." });
  }

  try {
    // Attempt database creation
    const result = await db.createRegistration(data);
    
    // Simulate SMS/Email notifications
    console.log(`[Notification Simulator] Sending registration success to ${data.phone_number} / ${data.email || 'N/A'} for Member ID: ${result.member_id}`);

    // Determine return message
    let successMessage = '';
    if (data.form_type === 'ward') {
      successMessage = "Thank you for registering! You are now a Ward Member of Hon. Korite Michael Kalango's campaign. Remember: bring at least 5 more PVC holders to complete your membership. Benefits await you after the election.";
    } else {
      const groupName = data.gender === 'Male' ? 'Kalango Boys' : 'Kalango Ladies';
      successMessage = `Welcome to ${groupName}! You have been registered. Find 5 more people in your community who need help — bring them in and register them. Your leader and Hon. Kalango are counting on you. After the election, you will be officially inaugurated.`;
    }

    return res.status(201).json({
      success: true,
      message: successMessage,
      member_id: result.member_id
    });

  } catch (error) {
    let reason = 'Unknown Error';
    let userErrorMessage = 'An error occurred during registration. Please try again.';

    if (error.message === 'PVC_DUPLICATE') {
      reason = 'Duplicate PVC';
      userErrorMessage = "This Voter's Card Number has already been used to register. If you believe this is an error, please contact the campaign office.";
      
      // Log attempt
      await db.logDuplicateAttempt({
        form_type: data.form_type,
        full_name: data.full_name,
        phone_number: data.phone_number,
        pvc: data.pvc,
        account_number: data.account_number,
        ip_address,
        attempt_reason: reason
      });
      return res.status(400).json({ error: userErrorMessage, code: 'PVC_DUPLICATE' });
    }

    if (error.message === 'ACCOUNT_DUPLICATE') {
      reason = 'Duplicate Bank Account';
      userErrorMessage = "This bank account number has already been registered. Each account number can only be used once. Please contact the campaign office if you need assistance.";
      
      // Log attempt
      await db.logDuplicateAttempt({
        form_type: data.form_type,
        full_name: data.full_name,
        phone_number: data.phone_number,
        pvc: data.pvc,
        account_number: data.account_number,
        ip_address,
        attempt_reason: reason
      });
      return res.status(400).json({ error: userErrorMessage, code: 'ACCOUNT_DUPLICATE' });
    }

    console.error('Registration insertion error:', error);
    return res.status(500).json({ error: userErrorMessage });
  }
});

// 3. Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const normalizedUsername = (username || '').toString().trim().toLowerCase();

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const adminUsernameNormalized = ADMIN_USERNAME.toString().trim().toLowerCase();
  if (normalizedUsername === adminUsernameNormalized) {
    if (password === ADMIN_PASSWORD) {
      res.cookie(SESSION_COOKIE, getAdminSessionToken(), {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 3600000
      });
      res.cookie(SESSION_USER_COOKIE, adminUsernameNormalized, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 3600000
      });
      return res.json({ success: true, role: 'admin', permissions: ['view_registrations', 'edit_users', 'view_duplicates', 'view_referrals', 'export_csv', 'manage_subadmins'] });
    }
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  try {
    const subadmin = await db.getSubadminByUsername(normalizedUsername);
    if (!subadmin || !subadmin.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!db.verifyPassword(password, subadmin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = generateSessionToken(subadmin.username, subadmin.password_hash);
    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 3600000
    });
    res.cookie(SESSION_USER_COOKIE, subadmin.username, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 3600000
    });

    return res.json({ success: true, role: 'subadmin', permissions: subadmin.permissions || [] });
  } catch (err) {
    console.error('Subadmin login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.clearCookie(SESSION_USER_COOKIE);
  res.json({ success: true });
});

// 5. Check Auth status
app.get('/api/admin/check-auth', async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  const username = (req.cookies[SESSION_USER_COOKIE] || '').toString().trim().toLowerCase();

  if (!token || !username) {
    return res.json({ authenticated: false });
  }

  const adminUsernameNormalized = ADMIN_USERNAME.toString().trim().toLowerCase();
  if ((username === adminUsernameNormalized || username === 'admin') && token === getAdminSessionToken()) {
    return res.json({ authenticated: true, role: 'admin', permissions: ['view_registrations', 'edit_users', 'view_duplicates', 'view_referrals', 'export_csv', 'manage_subadmins'] });
  }

  try {
    const subadmin = await db.getSubadminByUsername(username);
    if (!subadmin || !subadmin.active) {
      return res.json({ authenticated: false });
    }

    const expectedToken = generateSessionToken(subadmin.username, subadmin.password_hash);
    if (token !== expectedToken) {
      return res.json({ authenticated: false });
    }

    return res.json({ authenticated: true, role: 'subadmin', permissions: subadmin.permissions || [] });
  } catch (err) {
    console.error('Auth status error:', err);
    return res.json({ authenticated: false });
  }
});

// 6. Create Sub-admin
app.post('/api/admin/subadmins', authorizeAdmin, async (req, res) => {
  if (!hasPermission(req, 'manage_subadmins')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { username, password, permissions = [] } = req.body;
    const normalizedUsername = (username || '').toString().trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const subadmin = await db.createSubadmin({ username: normalizedUsername, password, permissions });
    return res.json({ success: true, subadmin });
  } catch (err) {
    console.error('Create subadmin error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// 7. List Sub-admins
app.get('/api/admin/subadmins', authorizeAdmin, async (req, res) => {
  if (!hasPermission(req, 'manage_subadmins')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const subadmins = await db.listSubadmins();
    res.json(subadmins);
  } catch (err) {
    console.error('List subadmins error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. Update Registration
app.put('/api/admin/registrations/:id', authorizeAdmin, async (req, res) => {
  if (!hasPermission(req, 'edit_users')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await db.updateRegistration(id, updates);
    res.json({ success: true, updated });
  } catch (err) {
    console.error('Update registration error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. Get Registrations (Filtered)
app.get('/api/admin/registrations', authorizeAdmin, async (req, res) => {
  try {
    const list = await db.getRegistrations(req.query);
    res.json(list);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. Get Stats
app.get('/api/admin/stats', authorizeAdmin, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. Get Duplicate attempts logs
app.get('/api/admin/duplicates', authorizeAdmin, async (req, res) => {
  try {
    const list = await db.getDuplicateAttempts();
    res.json(list);
  } catch (error) {
    console.error('Error fetching duplicate logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. Verify Member
app.post('/api/admin/verify', authorizeAdmin, async (req, res) => {
  try {
    const { id, is_verified } = req.body;
    if (id === undefined || is_verified === undefined) {
      return res.status(400).json({ error: 'Missing parameters id or is_verified' });
    }
    const success = await db.verifyMember(id, is_verified);
    res.json({ success });
  } catch (error) {
    console.error('Error verifying member:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 10. Get Referral Network data
app.get('/api/admin/referrals', authorizeAdmin, async (req, res) => {
  try {
    const network = await db.getReferralNetwork();
    res.json(network);
  } catch (error) {
    console.error('Error fetching referral network:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 11. CSV Export
app.get('/api/admin/export', authorizeAdmin, async (req, res) => {
  try {
    const { form_type } = req.query; // 'ward' | 'boys' | 'ladies'
    let filterType = form_type;
    
    // Convert to query filters
    const rawRecords = await db.getRegistrations({ form_type: filterType });
    const records = rawRecords.map(r => ({
      ...r,
      pvc: r.pvc || r.pvc_masked || '',
      account_number: r.account_number || r.account_num_masked || ''
    }));

    let csvFields = [];
    let filename = '';

    if (form_type === 'ward') {
      filename = 'Ward_Member_Registrations.csv';
      csvFields = [
        'member_id', 'full_name', 'phone_number', 'email', 'gender', 'dob',
        'ward', 'community', 'polling_unit', 'pvc', 'bank_name',
        'account_number', 'account_name', 'referrer_name', 'referrer_phone',
        'bringing_count', 'referral_names', 'is_verified', 'ip_address', 'timestamp'
      ];
    } else if (form_type === 'boys' || form_type === 'ladies') {
      filename = `${form_type === 'boys' ? 'Kalango_Boys' : 'Kalango_Ladies'}_Registrations.csv`;
      csvFields = [
        'member_id', 'full_name', 'phone_number', 'email', 'gender', 'dob',
        'ward', 'community', 'employment_status', 'occupation', 'skill_interest',
        'education_level', 'pvc', 'bank_name', 'account_number',
        'account_name', 'referral_names', 'is_verified', 'ip_address', 'timestamp'
      ];
    } else {
      return res.status(400).json({ error: 'Invalid or missing form_type' });
    }

    // Generate CSV string
    const csvContent = convertToCSV(records, csvFields);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csvContent);

  } catch (error) {
    console.error('Error exporting registrations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CSV generator helper
function convertToCSV(data, fields) {
  const header = fields.join(',');
  const rows = data.map(row => {
    return fields.map(field => {
      let val = row[field];
      if (val === null || val === undefined) {
        val = '';
      } else if (Array.isArray(val)) {
        val = val.join('; ');
      } else {
        val = val.toString().replace(/"/g, '""'); // Escape double quotes
        // If it contains commas, quotes, or newlines, wrap in quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
          val = `"${val}"`;
        }
      }
      return val;
    }).join(',');
  });
  return [header, ...rows].join('\r\n');
}

// Start database and then listen (only if run directly, not imported in serverless)
if (require.main === module) {
  db.initializeDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Database initialization failed at startup (running in offline/diagnostic mode):', err.message);
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT} (Database Offline)`);
      });
    });
}

module.exports = app;
