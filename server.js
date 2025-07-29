import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/', (req, res) => {
  res.redirect('/auto.html');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});