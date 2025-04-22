import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();



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

// Serve les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Route GET
app.get('/api/mon-endpoint', (req, res) => {
  res.json({ message: 'Hello from my API!' });
});

// Route POST
app.post('/api/mon-endpoint', async (req, res) => {
  try {
    // Authorization header check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'token manquant ou mal formé' });
    }
    const token = authHeader.split(' ')[1];

    // Vérifiez si le token existe dans Firestore
    let decodedToken;
try {
  decodedToken = await admin.auth().verifyIdToken(token);
} catch (error) {
  return res.status(401).json({ error: 'Token invalide ou expiré', details: error.message });
}

const uid = decodedToken.uid;

// Tu peux maintenant récupérer des infos depuis Firestore si besoin
let userData = null;
try {
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userData = userDoc.data();
  } else {
    return res.status(404).json({ error: 'Utilisateur non trouvé dans Firestore' });
  }
} catch (error) {
  return res.status(500).json({ error: 'Erreur lors de la récupération des données utilisateur', details: error.message });
}


    // Logique supplémentaire si nécessaire
    console.log('Utilisateur trouvé :', userData);

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

    const dataFile = path.join(DATA_DIR, `${token}.json`);
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

    res.json({ status: 'success', message: 'Données enregistrées', data_id: token });
  } catch (error) {
    console.error('Erreur lors de la vérification du token ou de l\'enregistrement des données:', error);
    res.status(500).json({ error: 'Erreur interne', details: error.message });
  }
});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
