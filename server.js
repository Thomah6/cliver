import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware de vérification du token
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant ou invalide" });
  }

  const token = authHeader.split(" ")[1];
  const db = getFirestore();

  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("token", "==", token).limit(1).get();

  if (snapshot.empty) {
    return res.status(401).json({ error: "Token invalide" });
  }

  req.user = snapshot.docs[0].data();
  next();
}

const app = express();
const DATA_DIR = path.resolve('./data');
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cleanAIResponse = (response) => {
  return response.replace(/<\/?[^>]+(>|$)/g, '').trim();
};

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/mon-endpoint', (req, res) => {
  res.json({ message: 'Hello from my API!' });
});

// Utilise le middleware sur ta route POST
app.post('/api/mon-endpoint', verifyToken, async (req, res) => {
  try {
    // Ici, req.user contient les infos utilisateur
    const userData = req.user;

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

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const dataFile = path.join(DATA_DIR, `${userData.token}.json`);
    if (fs.existsSync(dataFile) && fs.statSync(dataFile).size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Fichier trop gros' });
    }

    const payload = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      data,
    };

    const tempFile = path.join(DATA_DIR, `tmp_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
    fs.renameSync(tempFile, dataFile);

    const buglixRequest = req.headers['x-buglix-request'];
    if (buglixRequest === 'chat') {
      const { message, context } = data;

      const chatHistory = [
        {
          role: 'system',
          content: `# Contexte Général
Tu es une intelligence spécialisée intégrée dans un projet nommé **Buglix** — un SDK et un outil de debugging intelligent pour développeurs. Voici les informations du projet et des logs : ${JSON.stringify(payload, null, 2)}. Voici le contexte : ${context || 'aucun'}.`,
        },
        { role: 'user', content: message },
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer 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`,
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

    res.json({ status: 'success', message: 'Données enregistrées', data_id: userData.token });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des données:', error);
    res.status(500).json({ error: 'Erreur interne', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
