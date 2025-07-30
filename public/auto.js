// Configuración
const MAX_LEVEL = 400;
const CHECK_INTERVAL = 10000; // 10 segundos
const NOTIFICATION_SOUND_URL = './sound.mp3';
const LEVEL_1_ALARMED_KEY = 'level_1_alarmed ';

// Variables de estado
let history = [];
let intervalId = null;
let countdownInterval = null;
let timeLeft = CHECK_INTERVAL / 1000;
let soundEnabled = false;
let notificationSound = null;
let volume = 0.5;
let isSoundStopped = false;
let confirmedNotificationLevel = 400;
let currentLevelStartTime = null;
let averageLevelTime = null;
let currentLevel = 0;
let avgLast6 = null;
let lastLevelUpTime = null;
let hasLevel1Alarmed = false;
let slowLevelUpNotified = false; // Track slow level-up notification
let slowThreshold = 180; // Default slow level-up threshold in seconds

// Elementos DOM
const elements = {
 startButton: document.getElementById('startButton'),
 clearDataBtn: document.getElementById('clearDataBtn'),
 clearHistoryFileBtn: document.getElementById('clearHistoryFileBtn'),
 stopSoundBtn: document.getElementById('stopSoundBtn'),
 characterName: document.getElementById('characterName'),
 slowThreshold: document.getElementById('slowThreshold'),
 output: document.getElementById('output'),
 updateProgress: document.getElementById('updateProgress'),
 updateProgressCircle: document.getElementById('updateProgressCircle'),
 updateProgressText: document.getElementById('updateProgressText'),
 statsPanel: document.getElementById('statsPanel'),
 currentLevel: document.getElementById('currentLevel'),
 onlineStatus: document.getElementById('onlineStatus'),
 lastLevelUpTime: document.getElementById('lastLevelUpTime'),
 avgLast6: document.getElementById('avgLast6'),
 notificationLevel: document.getElementById('notificationLevel'),
 confirmLevelBtn: document.getElementById('confirmLevelBtn'),
 testSoundBtn: document.getElementById('testSoundBtn'),
 soundStatus: document.getElementById('soundStatus'),
 notificationVolume: document.getElementById('notificationVolume'),
 goalModal: document.getElementById('goalModal'),
 modalTitle: document.getElementById('modalTitle'),
 modalMessage: document.getElementById('modalMessage'),
 closeModalBtn: document.getElementById('closeModalBtn')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
 console.log('DOM fully loaded at 07:09 PM -04, July 29, 2025');
 
 // Debug: Check if output element exists
 if (!elements.output) {
 console.error('Output element not found in DOM');
 }
 
 elements.startButton.addEventListener('click', startMonitoring);
 elements.clearDataBtn.addEventListener('click', clearHistory);
 elements.clearHistoryFileBtn.addEventListener('click', clearHistoryFile);
 elements.stopSoundBtn.addEventListener('click', toggleSoundStop);
 elements.testSoundBtn.addEventListener('click', testNotificationSound);
 elements.confirmLevelBtn.addEventListener('click', confirmNotificationLevel);
 elements.closeModalBtn.addEventListener('click', closeGoalModal);
 elements.slowThreshold.addEventListener('change', updateSlowThreshold);
 elements.notificationVolume.addEventListener('input', updateVolume);

 // Cargar configuración desde localStorage
 soundEnabled = localStorage.getItem('soundEnabled') === 'true';
 isSoundStopped = localStorage.getItem('isSoundStopped') === 'true';
 confirmedNotificationLevel = parseInt(localStorage.getItem('notificationLevel')) || 400;
 volume = parseFloat(localStorage .getItem('notificationVolume')) || 0.5;
 hasLevel1Alarmed = localStorage.getItem(LEVEL_1_ALARMED_KEY) === 'true';
 slowThreshold = parseInt(localStorage.getItem('slowThreshold')) || 180;

 elements.notificationLevel.value = confirmedNotificationLevel;
 elements.slowThreshold.value = slowThreshold;
 elements.notificationVolume.value = volume;
 updateSoundStatus();
 updateStopButton();
 initializeSound();
});

function updateSlowThreshold() {
 slowThreshold = parseInt(elements.slowThreshold.value) || 180;
 if (slowThreshold < 0) slowThreshold = 0;
 localStorage.setItem('slowThreshold', slowThreshold);
 if (elements.output) {
 elements.output.innerHTML = `<p class="success">✓ Umbral de subida lenta ajustado a ${slowThreshold} segundos</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
}

function updateVolume() {
 volume = parseFloat(elements.notificationVolume.value);
 if (notificationSound) {
 notificationSound.volume = volume;
 }
 localStorage.setItem('notificationVolume', volume);
}

// Funciones de sonido
function initializeSound() {
 notificationSound = new Audio(NOTIFICATION_SOUND_URL);
 notificationSound.volume = volume;
 notificationSound.preload = 'auto';
 console.log('Sound initialized:', NOTIFICATION_SOUND_URL);
}

function updateSoundStatus() {
 elements.soundStatus.textContent = soundEnabled ? 'Sonido activado' : 'Sonido desactivado';
 elements.soundStatus.style.color = soundEnabled ? 'var(--primary)' : 'var(--warning)';
 localStorage.setItem('soundEnabled', soundEnabled);
}

function updateStopButton() {
 elements.stopSoundBtn.textContent = isSoundStopped ? 'Reactivar' : 'Silenciar';
 elements.stopSoundBtn.className = isSoundStopped ? 'button-warning' : 'button-danger';
 localStorage.setItem('isSoundStopped', isSoundStopped);
}

function toggleSoundStop() {
 isSoundStopped = !isSoundStopped;
 updateStopButton();
 if (isSoundStopped && notificationSound) {
 notificationSound.pause();
 notificationSound.currentTime = 0;
 notificationSound.loop = false;
 elements.goalModal.style.display = 'none';
 }
}

function testNotificationSound() {
 soundEnabled = true;
 isSoundStopped = false;
 updateSoundStatus();
 updateStopButton();
 playNotificationSound(false);
}

function playNotificationSound(loop = false) {
 if (soundEnabled && notificationSound && !isSoundStopped) {
 try {
 notificationSound.currentTime = 0;
 notificationSound.loop = loop;
 notificationSound.play().catch(e => {
 console.error("Error al reproducir sonido:", e);
 elements.soundStatus.textContent = "Error al reproducir sonido";
 });
 } catch (e) {
 console.error("Error con el sonido:", e);
 elements.soundStatus.textContent = "Error con el sonido";
 }
 }
}

function stopNotificationSound() {
 if (notificationSound) {
 notificationSound.pause();
 notificationSound.currentTime = 0;
 notificationSound.loop = false;
 }
}

// Funciones de interfaz
function showGoalModal(type, message, oneShot = false) {
 elements.modalTitle.textContent = 
 type === 'level' ? '¡Meta Alcanzada!' :
 type === 'offline' ? '¡Person aje Desconectado!' :
 type === 'level1' ? '¡Nivel 1 Detectado!' :
 '¡Demora en Subir de Nivel!';
 elements.modalMessage.textContent = message;
 elements.goalModal.style.display = 'flex';
 if (oneShot) slowLevelUpNotified = true; // Mark as notified for one-shot behavior
}

function closeGoalModal() {
 elements.goalModal.style.display = 'none';
 stopNotificationSound();
}

function confirmNotificationLevel() {
 const level = parseInt(elements.notificationLevel.value);
 if (isNaN(level) || level < 1 || level > MAX_LEVEL) {
 alert('Por favor, ingresa un nivel válido entre 1 y 400');
 return;
 }
 confirmedNotificationLevel = level;
 localStorage.setItem('notificationLevel', confirmedNotificationLevel);
 if (elements.output) {
 elements.output.innerHTML = `<p class="success">✓ Notificación establecida en nivel ${confirmedNotificationLevel}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
}

// Funciones de formato
function formatTime(seconds) {
 if (!seconds || seconds < 0) return 'N/A';
 seconds = Math.round(seconds);
 const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
 const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
 const s = String(seconds % 60).padStart(2, '0');
 return `${h}:${m}:${s}`;
}

// Funciones de cálculo
function calculateAverageLevelTime(history) {
 const levelTimes = [];
 
 for (let i = 1; i < history.length; i++) {
 if (history[i].level > history[i-1].level) {
 const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
 const levelDiff = history[i].level - history[i-1].level;
 const timePerLevel = timeDiff / levelDiff;
 for (let j = 0; j < levelDiff; j++) {
 levelTimes.push(timePerLevel);
 }
 }
 }
 
 const recentTimes = levelTimes.slice(-6);
 if (recentTimes.length === 0) return null;
 
 const avg = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
 const filteredTimes = recentTimes.filter(time => time <= avg * 2 && time > 0);
 
 if (filteredTimes.length === 0 && recentTimes.length > 0) {
 return recentTimes[recentTimes.length - 1];
 }
 
 const sum = filteredTimes.reduce((s, t) => s + t, 0);
 return sum / filteredTimes.length;
}

function calculateLast6Avg(history) {
 const levelTimes = [];
 
 for (let i = 1; i < history.length; i++) {
 if (history[i].level > history[i-1].level) {
 const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
 const levelDiff = history[i].level - history[i-1].level;
 const timePerLevel = timeDiff / levelDiff;
 for (let j = 0; j < levelDiff; j++) {
 levelTimes.push(timePerLevel);
 }
 }
 }
 
 const recentTimes = levelTimes.slice(-6);
 if (recentTimes.length === 0) return null;
 
 const sum = recentTimes.reduce((s, t) => s + t, 0);
 return sum / recentTimes.length;
}

// Funciones de gráfico
function buildLevelHistory(history, maxItems = 10) {
 const levels = [];
 const times = [];
 
 for (let i = 1; i < history.length; i++) {
 if (history[i].level > history[i-1].level) {
 const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
 const levelDiff = history[i].level - history[i-1].level;
 const timePerLevel = timeDiff / levelDiff;
 for (let j = 0; j < levelDiff; j++) {
 levels.push(history[i-1].level + j + 1);
 times.push(timePerLevel);
 }
 }
 }

 return {
 levels: levels.slice(-maxItems),
 times: times.slice(-maxItems),
 nextLevelTimes: []
 };
}

function updateLevelChart(historyData) {
 elements.levelChart.innerHTML = '';
 const maxTime = Math.max(...historyData.times, 10);
 
 historyData.levels.forEach((level, index) => {
 const barHeight = (historyData.times[index] / maxTime) * 100;
 const bar = document.createElement('div');
 bar.className = 'level-bar';
 bar.style.height = `${barHeight}%`;
 
 const label = document.createElement('div');
 label.className = 'level-label ';
 label.textContent = `${level} (${formatTime(historyData.times[index])})`;
 
 bar.appendChild(label);
 elements.levelChart.appendChild(bar);
 });
}

// Funciones de almacenamiento
async function loadHistory(name) {
 console.log(`Loading history for ${name}`);
 try {
 const response = await fetch(`/history?name=${encodeURIComponent(name)}`);
 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
 const data = await response.json();
 console.log(`History loaded for ${name}:`, data);
 if (data.length > 0) {
 currentLevelStartTime = data[data.length - 1].timestamp;
 currentLevel = data[data.length - 1].level;
 averageLevelTime = calculateAverageLevelTime(data);
 avgLast6 = calculateLast6Avg(data);
 
 if (avgLast6) {
 elements.avgLast6.textContent = formatTime(avgLast6);
 }
 
 // Calculate last level-up time
 for (let i = data.length - 1; i > 0; i--) {
 if (data[i].level > data[i-1].level) {
 lastLevelUpTime = (new Date(data[i].timestamp) - new Date(data[i-1].timestamp)) / 1000;
 elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
 break;
 }
 }
 }
 return data;
 } catch (err) {
 console.error('Error loading history:', err);
 if (elements.output) {
 elements.output.innerHTML = `<p class="warning">⚠️ Error al cargar historial: ${err.message}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 return [];
 }
}

async function saveHistory(name, history) {
 console.log(`Saving history for ${name}:`, history);
 try {
 await fetch('/history', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name, history })
 });
 } catch (err) {
 console.error('Error saving history:', err);
 if (elements.output) {
 elements.output.innerHTML = `<p class="warning">⚠️ Error al guardar historial: ${err.message}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 }
}

async function clearHistory() {
 const name = elements.characterName.value.trim();
 if (!name) return alert('Ingresa un nombre para borrar sus datos');
 
 if (confirm(`¿Borrar todos los datos de ${name}?`)) {
 history = [];
 currentLevelStartTime = null;
 averageLevelTime = null;
 currentLevel = 0;
 avgLast6 = null;
 lastLevelUpTime = null;
 hasLevel1Alarmed = false;
 slowLevelUpNotified = false;
 localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
 await saveHistory(name, history);
 if (elements.output) {
 elements.output.innerHTML = `<p class="success">✓ Datos borrados para ${name}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 elements.statsPanel.style.display = 'none';
 elements.updateProgress.style.display = 'none';
 clearInterval(intervalId);
 clearInterval(countdownInterval);
 
 elements.avgLast6.textContent = '00:00:00';
 elements.lastLevelUpTime.textContent = 'N/A';
 }
}

async function clearHistoryFile() {
 const name = elements.characterName.value.trim();
 if (!name) return alert('Ingresa un nombre para borrar el archivo de historial');
 
 if (confirm(`¿Borrar el archivo de historial para ${name}?`)) {
 try {
 await fetch(`/history?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
 if (elements.output) {
 elements.output.innerHTML = `<p class="success">✓ Archivo de historial borrado para ${name}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 await clearHistory();
 } catch (err) {
 console.error(`Error clearing history for ${name}:`, err);
 if (elements.output) {
 elements.output.innerHTML = `<p class="warning">⚠️ Error al borrar el archivo: ${err.message}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 }
 }
}

// Funciones de monitoreo
async function fetchLevel(name) {
 console.log(`Fetching level for ${name}`);
 try {
 const response = await fetch(`/level?name=${encodeURIComponent(name)}`);
 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
 const data = await response.json();
 console.log(`Level data received for ${name}:`, data);
 if (!data.level || typeof data.isOnline !== 'boolean') {
 throw new Error('Invalid level data format');
 }
 return data;
 } catch (err) {
 console.error('Error fetching level:', err);
 if (elements.output) {
 elements.output.innerHTML = `<p class="warning">⚠️ Error al obtener nivel: ${err.message}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 throw err;
 }
}

async function monitor(name) {
 console.log(`Monitoring ${name} at ${new Date().toISOString()}`);
 try {
 const { level, isOnline } = await fetchLevel(name);
 const now = new Date().toISOString();
 const lastEntry = history.length > 0 ? history[history.length - 1] : null;
 
 elements.onlineStatus.textContent = isOnline ? 'Online' : 'Offline';
 elements.onlineStatus.style.color = isOnline ? 'var(--primary)' : 'var(--danger)';
 
 if (!lastEntry || lastEntry.level !== level) {
 history.push({ level, timestamp: now });
 await saveHistory(name, history);
 
 if (lastEntry && lastEntry.level < level) {
 lastLevelUpTime = (new Date(now) - new Date(lastEntry.timestamp)) / 1000;
 elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
 console.log(`Level up detected, lastLevelUpTime: ${lastLevelUpTime} seconds`);
 slowLevelUpNotified = false; // Reset notification on level up
 }
 
 currentLevelStartTime = now;
 averageLevelTime = calculateAverageLevelTime(history);
 avgLast6 = calculateLast6Avg(history);
 
 if (avgLast6) {
 elements.avgLast6.textContent = formatTime(avgLast6);
 }
 
 const historyData = buildLevelHistory(history);
 updateLevelChart(historyData);
 
 if (level === confirmedNotificationLevel && !isSoundStopped) {
 playNotificationSound(true);
 showGoalModal('level', `¡Has alcanzado el nivel ${level}!`);
 if (elements.output) {
 elements.output.innerHTML += `<p class="success">🎉 ¡Meta alcanzada! Nivel ${level} obtenido.</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 }
 
 if (level === 1 && !hasLevel1Alarmed && !isSoundStopped) {
 playNotificationSound(true);
 showGoalModal('level1', `¡Estás en nivel 1!`);
 if (elements.output) {
 elements.output.innerHTML += `<p class="warning">⚠️ ¡Personaje en nivel 1!</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 hasLevel1Alarmed = true;
 localStorage.setItem(LEVEL_1_ALARMED_KEY, 'true');
 }
 
 // Check for slow level-up (death detection)
 if (lastLevelUpTime && !isSoundStopped && currentLevel < MAX_LEVEL && !slowLevelUpNotified) {
 const timeSinceLastLevelUp = (new Date(now) - new Date(currentLevelStartTime)) / 1000;
 if (timeSinceLastLevelUp > slowThreshold) {
 playNotificationSound(true); // Play in loop for slow level-up
 showGoalModal('delay', `¡Subida lenta detectada! Tiempo: ${formatTime(timeSinceLastLevelUp)}`, true);
 if (elements.output) {
 elements.output.innerHTML += `<p class="warning">⚠️ Subida lenta: ${formatTime(timeSinceLastLevelUp)}</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 }
 }
 } else if (level !== 1 && hasLevel1Alarmed) {
 hasLevel1Alarmed = false;
 localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
 }
 
 currentLevel = level;
 elements.currentLevel.textContent = level;
 elements.statsPanel.style.display = 'block';
 elements.updateProgress.style.display = 'block';
 
 if (!isOnline && !isSoundStopped) {
 playNotificationSound(true);
 showGoalModal('offline', `¡${name} está desconectado!`);
 if (elements.output) {
 elements.output.innerHTML += `<p class="alert">⚠️ ¡Personaje desconectado!</p>`;
 } else {
 console.error('Cannot set output.innerHTML: output element is undefined');
 }
 }
 
 startCountdown();
 
 } catch (err) {
 console.error('Error in monitor:', err);
 elements.onlineStatus.textContent = 'Error';
 elements.onlineStatus.style.color = 'var(--warning)';
 }
}

function startCountdown() {
 clearInterval(countdownInterval);
 timeLeft = CHECK_INTERVAL / 1000;
 updateProgressCircle(100);
 
 countdownInterval = setInterval(() => {
 timeLeft--;
 const percent = (timeLeft / (CHECK_INTERVAL / 1000)) * 100;
 updateProgressCircle(percent);
 
 if (timeLeft <= 0) {
 timeLeft = CHECK_INTERVAL / 1000;
 }
 }, 1000);
}

function updateProgressCircle(percent) {
 const offset = 157 - (percent / 100) * 157; // 157 is circumference (2 * π * 25)
 elements.updateProgressCircle.style.strokeDashoffset = offset;
 elements.updateProgressText.textContent = `${Math.round(timeLeft)}s`;
}

// Iniciar monitoreo
async function startMonitoring() {
 const name = elements.characterName.value.trim();
 if (!name) return alert('Ingresa un nombre de personaje');
 
 clearInterval(intervalId);
 history = await loadHistory(name);
 console.log(`Starting monitoring for ${name}, initial history:`, history);
 await monitor(name);
 intervalId = setInterval(() => monitor(name), CHECK_INTERVAL);
}