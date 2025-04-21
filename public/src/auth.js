import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export const register = async (username, email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

     // Token généré à la mano
    const token = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );

    
    // Enregistrer l'utilisateur dans Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: user.email,
      uid: user.uid,
      requests: 30, // Valeur par défaut
      token,
      createdAt: new Date(),
    });

    console.log("Inscription réussie :", user);
    return user;
  } catch (error) {
    console.error("Erreur d'inscription :", error.message);
    throw new Error("Inscription échouée. Vérifiez vos informations.");
  }
};

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Connexion réussie :", userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error("Erreur de connexion :", error.message);
    throw new Error("Connexion échouée. Vérifiez vos identifiants.");
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    console.log("Déconnexion réussie");
  } catch (error) {
    console.error("Erreur de déconnexion :", error.message);
    throw new Error("Déconnexion échouée. Réessayez.");
  }
};

export const getUserInfo = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      throw new Error("Utilisateur non trouvé dans Firestore.");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des informations utilisateur :", error.message);
    throw error;
  }
};

export const checkUserExists = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return { exists: true, data: userDoc.data() }; // L'utilisateur existe, renvoie ses données
    } else {
      return { exists: false, message: "Utilisateur non trouvé." }; // L'utilisateur n'existe pas
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de l'utilisateur :", error.message);
    throw new Error("Une erreur est survenue lors de la vérification de l'utilisateur.");
  }
};
