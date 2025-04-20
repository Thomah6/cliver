import express from 'express';
import bodyParser from 'body-parser';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Helper function to clean AI response
const cleanAIResponse = (response) => {
  return response.replace(/<\/?[^>]+(>|$)/g, '').trim(); // Remove HTML tags and trim
};

// POST endpoint
app.post('/api', async (req, res) => {
  try {
    // Authorization header check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UID manquant ou mal formé' });
    }
    const uid = authHeader.split(' ')[1];

    // Verify UID in Firebase
    const userRef = doc(db, 'users', uid); // Replace 'users' with your collection name
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'UID non trouvé' });
    }

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

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Données vides ou non valides' });
    }

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const dataFile = path.join(DATA_DIR, `${uid}.json`);
    if (fs.existsSync(dataFile) && fs.statSync(dataFile).size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Fichier trop gros' });
    }

    // Save data securely
    const payload = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      data,
    };

    const tempFile = path.join(DATA_DIR, `tmp_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
    fs.renameSync(tempFile, dataFile);

    // Handle x-buglix-request header
    const buglixRequest = req.headers['x-buglix-request'];
    if (buglixRequest === 'chat') {
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
    }

    res.json({ status: 'success', message: 'Données enregistrées', data_id: uid });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur interne', details: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
