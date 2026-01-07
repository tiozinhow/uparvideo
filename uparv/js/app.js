// Database para armazenar vídeos localmente
const VideoDB = (() => {
    const DB_NAME = 'VideoLocalDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'videos';
    
    let db = null;
    
    // Inicializar banco de dados
    const initDB = () => {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }
            
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('Erro ao abrir IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Criar object store se não existir
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    
                    // Criar índices para busca rápida
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('uploadDate', 'uploadDate', { unique: false });
                    store.createIndex('views', 'views', { unique: false });
                }
            };
        });
    };
    
    // Salvar vídeo
    const saveVideo = async (videoData) => {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put(videoData);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    };
    
    // Obter vídeo por ID
    const getVideo = async (id) => {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    };
    
    // Obter todos os vídeos
    const getAllVideos = async () => {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('uploadDate');
            
            const request = index.openCursor(null, 'prev'); // Ordem decrescente (mais recente primeiro)
            const videos = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    videos.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(videos);
                }
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    };
    
    // Atualizar vídeo
    const updateVideo = async (videoData) => {
        return saveVideo(videoData);
    };
    
    // Deletar vídeo
    const deleteVideo = async (id) => {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.delete(id);
            
            request.onsuccess = () => {
                resolve(true);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    };
    
    // Limpar todos os vídeos
    const clearAll = async () => {
        const db = await initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.clear();
            
            request.onsuccess = () => {
                resolve(true);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    };
    
    // Obter estatísticas
    const getStats = async () => {
        const videos = await getAllVideos();
        
        let totalSize = 0;
        let totalViews = 0;
        
        videos.forEach(video => {
            totalSize += video.size || 0;
            totalViews += video.views || 0;
        });
        
        return {
            totalVideos: videos.length,
            totalSize,
            totalViews
        };
    };
    
    return {
        initDB,
        saveVideo,
        getVideo,
        getAllVideos,
        updateVideo,
        deleteVideo,
        clearAll,
        getStats
    };
})();

// Inicializar banco de dados quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    VideoDB.initDB().catch(console.error);
});

// Service Worker para PWA (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
}