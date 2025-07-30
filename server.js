import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory with correct MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Middleware to parse JSON bodies for POST requests
app.use(express.json());

// Endpoint to fetch level from mu-party.com
app.get('/level', async (req, res) => {
  const characterName = req.query.name;
  if (!characterName) {
    return res.status(400).json({ error: 'Falta parámetro "name"' });
  }

  try {
    const url = 'https://mu-party.com/rankings/resets/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });
    const $ = load(response.data);

    let level = null;
    let isOnline = false;
    $('tr[data-class-id]').each((_, el) => {
      const cells = $(el).find('td');
      const name = cells.eq(3).text().trim().toLowerCase();
      if (name === characterName.toLowerCase()) {
        level = parseInt(cells.eq(4).text().trim());
        const statusImg = cells.eq(3).find('img.online-status-indicator').attr('src');
        isOnline = statusImg && statusImg.includes('online.png');
        return false;
      }
    });

    if (level === null) {
      return res.status(404).json({ error: 'Personaje no encontrado' });
    }

    res.json({ level, isOnline });
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// Endpoint to read history from txt in the 'public' directory
app.get('/history', async (req, res) => {
  const name = req.query.name;
  console.log(`History read request for ${name} at ${new Date().toISOString()}`);
  try {
    const filePath = path.join(__dirname, 'public', `history_${name}.txt`);
    const data = await fs.readFile(filePath, 'utf8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(`Error reading history for ${name}:`, err);
    res.json([]);
  }
});

// Endpoint to save history to txt in the 'public' directory
app.post('/history', async (req, res) => {
  const { name, history } = req.body;
  console.log(`History save request for ${name} at ${new Date().toISOString()}`);
  try {
    const filePath = path.join(__dirname, 'public', `history_${name}.txt`);
    await fs.writeFile(filePath, JSON.stringify(history));
    res.json({ success: true });
  } catch (err) {
    console.error(`Error saving history for ${name}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to clear history txt in the 'public' directory
app.delete('/history', async (req, res) => {
  const name = req.query.name;
  console.log(`History clear request for ${name} at ${new Date().toISOString()}`);
  try {
    const filePath = path.join(__dirname, 'public', `history_${name}.txt`);
    await fs.unlink(filePath).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error(`Error clearing history for ${name}:`, err);
    res.json({ success: true }); // Ignore if file doesn't exist
  }
});

// Redirect root to auto.html
app.get('/', (req, res) => {
  res.redirect('/auto.html');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT} at 05:26 AM -04, July 30, 2025`);
});