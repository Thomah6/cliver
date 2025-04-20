import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics.js";

let firebaseConfig;

async function loadFirebaseConfig() {
  const response = await fetch("../config/firebase-config.json");
  firebaseConfig = await response.json();
  const app = initializeApp(firebaseConfig);
  getAnalytics(app); // Initialiser Firebase Analytics
  const auth = getAuth(app);
  const db = getFirestore(app); // Initialiser Firestore
  return { auth, db };
}

const { auth, db } = await loadFirebaseConfig();

export { auth, db };
