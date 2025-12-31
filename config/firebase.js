const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('⚠️ Firebase env vars missing. Push will be disabled.');
    return null;
  }

  // Render غالبًا يخزنها كسطر واحد
  privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  initialized = true;
  console.log('✅ Firebase Admin initialized');
  return admin;
}

module.exports = { initFirebase };
