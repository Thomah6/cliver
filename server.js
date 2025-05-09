import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bodyParser from 'body-parser';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import fetch from 'node-fetch'; // Ensure this is installed for API calls

// Firebase configuration (hardcoded for now)
const firebaseConfig = {
  apiKey: "AIzaSyA_1hoEtwJkF_lJC1Jnp4dgQhTdHBrmTJ4",
  authDomain: "clifixer.firebaseapp.com",
  projectId: "clifixer",
  storageBucket: "clifixer.firebasestorage.app",
  messagingSenderId: "318234897260",
  appId: "1:318234897260:web:18b58b8df79059bd486149",
  measurementId: "G-WECQ09G5K5",
};


// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
const DATA_DIR = path.resolve('./data');
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pour parser les body en JSON (important pour les POST)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Helper function to clean AI response
const cleanAIResponse = (response) => {
  return response.replace(/<\/?[^>]+(>|$)/g, '').trim(); // Remove HTML tags and trim
};


const port = process.env.PORT || 3000;

async function verifyUserWithEmailAndPassword(email, password) {
  const apiKey = "AIzaSyA_1hoEtwJkF_lJC1Jnp4dgQhTdHBrmTJ4"; // Ton apiKey Firebase
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true
    })
  });
  if (!response.ok) {
    return null;
  }
  return await response.json();
}

// Serve les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Route GET
app.get('/api/mon-endpoint', (req, res) => {
  res.json({ message: 'Hello from my API!' });


});

// Route POST
app.post('/api/mon-endpoint', async (req, res) => {
  try {
    const email = req.headers['x-buglix-email'];
    const pass = req.headers['x-buglix-pass'];

    // Vérifie l'utilisateur
    const user = await verifyUserWithEmailAndPassword(email, pass);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // ...le reste de ton code...

    // Parse request body
    const contentType = req.headers['content-type'];
    let data;
    if (contentType.includes('application/json')) {
      data = req.body;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = JSON.parse(req.body.data || '{}');
    } else {
      return res.status(415).json({ error: 'Format non supporté' });
    }

    
   

    // Handle x-buglix-request header
    const buglixRequest = req.headers['x-buglix-request'];
    if (buglixRequest === 'chat') {
      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Données vides ou non valides' });
      }
  
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
  
      
  
      // Save data securely
      const payload = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        data,
      };
  
      const { message, context } = data;

      // Prepare chat history
      const chatHistory = [
        {
          role: 'system',
          content: `# Contexte Général
Tu es une intelligence spécialisée intégrée dans un projet nommé **Buglix** — un SDK et un outil de debugging intelligent pour développeurs. Voici les informations du projet et des logs : ${JSON.stringify(payload, null, 2)}. Voici le contexte : ${context || 'aucun'}.`,
        },
        { role: 'user', content: message },
      ];

      // Call Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer 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`, // Hardcoded API key for now
        },
        body: JSON.stringify({
          messages: chatHistory,
          model: 'llama3-8b-8192',
          temperature: 1.0,
          max_tokens: 500,
        }),
      });

      const responseData = await response.json();
      if (response.ok && responseData.choices?.[0]?.message?.content) {
        const assistantMessage = cleanAIResponse(responseData.choices[0].message.content);
        return res.json({ success: true, content: assistantMessage });
      } else {
        return res.status(500).json({ error: 'Erreur API', details: responseData });
      }
    }else if(buglixRequest === 'init'){
     
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }else{
        return res.status(200).json({ success: 'Correct' });
      }
    }

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur interne', details: error.message });
  }
});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
