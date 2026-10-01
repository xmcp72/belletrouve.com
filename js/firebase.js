// Belle Trouvé — Firebase (web app registered in the chic-vivo project)
// SDK modules are loaded lazily so the app shell renders even if the CDN is slow,
// and Auth is only loaded when a feature needs it (favorites).

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

const firebaseConfig = {
  // Session 55: switched to the Browser key. The site had been using the iOS key (…JTf0) by mistake;
  // the Browser key is restricted to belletrouve.com + localhost and to Firestore / Auth only.
  apiKey:            'AIzaSyDQDjkOej2lm6YXZfL-a1tCrQ6uaHcOs8A',
  authDomain:        'chic-vivo.firebaseapp.com',
  projectId:         'chic-vivo',
  storageBucket:     'chic-vivo.firebasestorage.app',
  messagingSenderId: '356828431474',
  appId:             '1:356828431474:web:569c50c422634a92516eeb',
  measurementId:     'G-QJ2ZF27ZGV',
};

let appPromise = null;
let firestorePromise = null;
let authPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import(`${FIREBASE_SDK}/firebase-app.js`)
      .then(({ initializeApp }) => initializeApp(firebaseConfig))
      .catch((err) => { appPromise = null; throw err; });
  }
  return appPromise;
}

/** Returns { db, fs } where fs is the Firestore module namespace. */
export function getFirestoreKit() {
  if (!firestorePromise) {
    firestorePromise = Promise.all([getApp(), import(`${FIREBASE_SDK}/firebase-firestore.js`)])
      .then(([app, fs]) => ({ db: fs.getFirestore(app), fs }))
      .catch((err) => { firestorePromise = null; throw err; });
  }
  return firestorePromise;
}

/** Returns { auth, authMod } where authMod is the Auth module namespace. */
export function getAuthKit() {
  if (!authPromise) {
    authPromise = Promise.all([getApp(), import(`${FIREBASE_SDK}/firebase-auth.js`)])
      .then(([app, authMod]) => ({ auth: authMod.getAuth(app), authMod }))
      .catch((err) => { authPromise = null; throw err; });
  }
  return authPromise;
}
