// Configuração do IndexedDB
const DB_NAME = 'VideoShareDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

let db = null;

// Inicializar o banco de dados
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('title', 'title', { unique: false });
                store.createIndex('uploadDate', 'uploadDate', { unique: false });
            }
        };
    });
}

// Salvar vídeo
async function saveVideo(video) {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(video);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(video);
    });
}

// Obter todos os vídeos
async function getAllVideos() {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('uploadDate');
        const request = index.openCursor(null, 'prev'); // Ordem decrescente
        const videos = [];

        request.onerror = () => reject(request.error);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                videos.push(cursor.value);
                cursor.continue();
            } else {
                resolve(videos);
            }
        };
    });
}

// Obter vídeo por ID
async function getVideo(id) {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Remover vídeo
async function removeVideo(id) {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Limpar todos os vídeos (para testes)
async function clearVideos() {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Importar vídeo (a partir de dados exportados)
async function importVideo(data) {
    // Verificar se o vídeo já existe
    const existing = await getVideo(data.id);
    if (existing) {
        // Se existir, podemos sobrescrever ou gerar um novo ID
        // Vamos gerar um novo ID para evitar conflitos
        data.id = generateId();
    }

    // Salvar o vídeo
    await saveVideo(data);
}