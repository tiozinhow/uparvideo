// Funções comuns

// Gerar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Criar thumbnail a partir de um vídeo
function createThumbnail(videoFile) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            video.currentTime = 1; // Pegar um frame no primeiro segundo
        };

        video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg'));
        };

        video.onerror = reject;

        video.src = URL.createObjectURL(videoFile);
    });
}

// Exportar vídeo (para compartilhamento)
async function exportVideo(id) {
    const video = await getVideo(id);
    if (!video) {
        throw new Error('Vídeo não encontrado');
    }

    // Criar um objeto com os dados do vídeo (sem o dataURL se for muito grande)
    // Ou incluir o dataURL se for viável
    const exportData = {
        ...video,
        exportedAt: new Date().toISOString()
    };

    return exportData;
}