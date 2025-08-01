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

// --- Middlewares ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- LÓGICA DE ALMACENAMIENTO ---
const historyDir = process.env.HISTORY_PATH || path.join(__dirname, 'history_data_fallback');
console.log(`Servidor configurado para usar la ruta de historial: ${historyDir}`);

// Se asegura de que el directorio de historial exista.
const ensureHistoryDir = async () => {
    try {
        await fs.mkdir(historyDir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error("Error CRÍTICO al crear el directorio de historial:", error);
            // Si no se puede crear la carpeta, lanzamos el error para que sea capturado por la ruta.
            throw error;
        }
    }
};

function sanitizeFilename(name) {
  if (!name) return '';
  return name.replace(/[^a-z0-9_-]/gi, '_');
}

// --- Endpoint para el scraping del nivel ---
app.get('/level', async (req, res) => {
    try {
        const characterName = req.query.name;
        if (!characterName) {
            return res.status(400).json({ error: 'Falta parámetro "name"' });
        }
        const url = 'https://mu-party.com/rankings/resets/';
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = load(response.data);
        let level = null;
        let isOnline = false;
        $('tr[data-class-id]').each((_, el) => {
            const cells = $(el).find('td');
            const name = cells.eq(3).text().trim();
            if (name.toLowerCase() === characterName.toLowerCase()) {
                level = parseInt(cells.eq(4).text().trim(), 10);
                const statusImg = cells.eq(3).find('img.online-status-indicator').attr('src');
                isOnline = statusImg && statusImg.includes('online.png');
                return false;
            }
        });
        if (level === null) return res.status(404).json({ error: 'Personaje no encontrado' });
        res.json({ level, isOnline });
    } catch (error) {
        console.error('[GET /level] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener datos del servidor de MU' });
    }
});

// --- Endpoints para el historial (ahora 100% a prueba de errores) ---
app.get('/history', async (req, res) => {
    try {
        await ensureHistoryDir();
        const safeName = sanitizeFilename(req.query.name);
        if (!safeName) return res.json([]);
        
        const filePath = path.join(historyDir, `${safeName}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        // Si el archivo no existe (ENOENT), es normal. Devolvemos un array vacío.
        if (error.code === 'ENOENT') {
            return res.json([]);
        }
        // Para cualquier otro error, lo registramos y devolvemos un error 500.
        console.error(`[GET /history] Error para ${req.query.name}:`, error);
        res.status(500).json({ error: 'Error interno al leer el historial.' });
    }
});

app.post('/history', async (req, res) => {
    try {
        await ensureHistoryDir();
        const safeName = sanitizeFilename(req.body.name);
        const { history } = req.body;
        if (!safeName || !history) {
            return res.status(400).json({ error: 'Faltan datos (nombre o historial).' });
        }
        const filePath = path.join(historyDir, `${safeName}.json`);
        await fs.writeFile(filePath, JSON.stringify(history, null, 2));
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(`[POST /history] Error para ${req.body.name}:`, error);
        res.status(500).json({ error: 'Error interno al guardar el historial.' });
    }
});

app.delete('/history', async (req, res) => {
    try {
        await ensureHistoryDir();
        const safeName = sanitizeFilename(req.query.name);
        if (!safeName) return res.status(200).json({ success: true });
        
        const filePath = path.join(historyDir, `${safeName}.json`);
        await fs.unlink(filePath);
        res.status(200).json({ success: true });
    } catch (error) {
        // Si el archivo no existe, no es un error.
        if (error.code === 'ENOENT') {
            return res.status(200).json({ success: true });
        }
        console.error(`[DELETE /history] Error para ${req.query.name}:`, error);
        res.status(500).json({ error: 'Error interno al borrar el historial.' });
    }
});

app.get('/', (req, res) => {
    res.redirect('/auto.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
