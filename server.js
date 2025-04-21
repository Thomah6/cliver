import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve les fichiers statiques (ton front-end HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Exemple d'API
app.get('/api/mon-endpoint', (req, res) => {
  res.json({ message: 'Hello from my API!' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
