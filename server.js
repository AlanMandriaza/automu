import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuración de rutas para Módulos ES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// --- Middlewares ---
app.use(express.json()); // Para parsear JSON en POST requests
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos

// --- Endpoint para el scraping del nivel ---
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
            const name = cells.eq(3).text().trim();
            if (name.toLowerCase() === characterName.toLowerCase()) {
                level = parseInt(cells.eq(4).text().trim(), 10);
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
        console.error('Error en el scraping:', error.message);
        res.status(500).json({ error: 'Error al obtener datos del servidor de MU' });
    }
});

// --- Endpoints para el historial ---
const historyDir = path.join(__dirname, 'history_data');

const ensureHistoryDir = async () => {
    try {
        await fs.mkdir(historyDir);
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
};

app.get('/history', async (req, res) => {
    const { name } = req.query;
    const filePath = path.join(historyDir, `${name}.json`);
    try {
        await ensureHistoryDir();
        const data = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json([]);
    }
});

app.post('/history', async (req, res) => {
    const { name, history } = req.body;
    const filePath = path.join(historyDir, `${name}.json`);
    try {
        await ensureHistoryDir();
        await fs.writeFile(filePath, JSON.stringify(history, null, 2));
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(`Error guardando historial para ${name}:`, error);
        res.status(500).json({ error: 'Error al guardar el historial' });
    }
});

app.delete('/history', async (req, res) => {
    const { name } = req.query;
    const filePath = path.join(historyDir, `${name}.json`);
    try {
        await fs.unlink(filePath);
        res.status(200).json({ success: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(200).json({ success: true, message: 'No history file to delete.' });
        }
        console.error(`Error borrando historial para ${name}:`, error);
        res.status(500).json({ error: 'Error al borrar el historial' });
    }
});

// --- **AÑADIDO PARA SOLUCIONAR EL 404** ---
// Redirige la ruta raíz a tu archivo HTML principal
app.get('/', (req, res) => {
    res.redirect('/auto.html');
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
