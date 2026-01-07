// VideoShare Ultra - Sistema de Compartilhamento Offline
class OfflineShare {
    constructor() {
        this.shareCodes = new Map();
        this.peerConnections = new Map();
        this.init();
    }

    async init() {
        // Carregar códigos de compartilhamento salvos
        await this.loadShareCodes();
        // Inicializar WebRTC para compartilhamento direto
        await this.initWebRTC();
    }

    // ========== COMPARTILHAMENTO VIA ARQUIVO ==========

    // Exportar vídeo para arquivo .vshare (funciona offline)
    async exportVideo(videoId) {
        try {
            const video = await VideoDB.getVideo(videoId);
            if (!video) throw new Error('Vídeo não encontrado');

            // Criar objeto de compartilhamento
            const shareData = {
                type: 'videoshare_export',
                version: '2.0',
                timestamp: new Date().toISOString(),
                video: {
                    id: video.id,
                    title: video.title,
                    description: video.description,
                    duration: video.duration,
                    size: video.size,
                    data: video.data, // Base64 do vídeo
                    type: video.type,
                    thumbnail: video.thumbnail,
                    createdAt: video.createdAt,
                    tags: video.tags || []
                },
                metadata: {
                    exportedFrom: 'VideoShare Ultra',
                    exportDate: new Date().toISOString(),
                    appVersion: '2.0.0'
                }
            };

            // Converter para JSON
            const jsonData = JSON.stringify(shareData, null, 2);
            
            // Criar blob e URL para download
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Criar link de download
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.sanitizeFilename(video.title)}.vshare`;
            document.body.appendChild(a);
            a.click();
            
            // Limpar
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            // Log
            await this.logShare(videoId, 'export');
            
            return {
                success: true,
                filename: `${video.title}.vshare`,
                size: blob.size
            };

        } catch (error) {
            console.error('Erro ao exportar vídeo:', error);
            throw error;
        }
    }

    // Importar vídeo de arquivo .vshare
    async importVideo(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Validar formato
                    if (!data.video || !data.video.data) {
                        throw new Error('Formato de arquivo inválido');
                    }

                    // Verificar se vídeo já existe
                    const existingVideo = await VideoDB.getVideo(data.video.id);
                    if (existingVideo) {
                        // Gerar novo ID para evitar conflito
                        data.video.id = this.generateId();
                    }

                    // Adicionar metadados de importação
                    data.video.importedAt = new Date().toISOString();
                    data.video.importedFrom = data.metadata?.exportedFrom || 'Unknown';
                    
                    // Salvar vídeo
                    await VideoDB.saveVideo(data.video);
                    
                    // Log
                    await this.logShare(data.video.id, 'import');
                    
                    resolve({
                        success: true,
                        video: data.video,
                        imported: true
                    });

                } catch (error) {
                    reject(new Error(`Erro ao importar: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Erro ao ler arquivo'));
            };

            reader.readAsText(file);
        });
    }

    // ========== COMPARTILHAMENTO VIA QR CODE ==========

    // Gerar QR Code para compartilhamento offline
    async generateShareQR(videoId, options = {}) {
        const video = await VideoDB.getVideo(videoId);
        if (!video) throw new Error('Vídeo não encontrado');

        // Criar dados compactos para QR Code
        const shareData = {
            t: video.title,
            d: Math.round(video.duration),
            s: Math.round(video.size / 1024), // KB
            ts: Date.now()
        };

        // Adicionar código de acesso (se necessário)
        if (options.password) {
            shareData.p = await this.hashPassword(options.password);
        }

        // Converter para string base64
        const jsonStr = JSON.stringify(shareData);
        const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
        
        // Criar URL de compartilhamento
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${base64Data}&vid=${videoId.substring(0, 8)}`;
        
        return {
            url: shareUrl,
            data: base64Data,
            video: {
                title: video.title,
                duration: video.duration,
                size: video.size
            }
        };
    }

    // Processar QR Code escaneado
    async processQRCode(qrData) {
        try {
            // Decodificar base64
            const jsonStr = decodeURIComponent(escape(atob(qrData)));
            const data = JSON.parse(jsonStr);
            
            return {
                valid: true,
                data: data,
                timestamp: new Date(data.ts),
                hasPassword: !!data.p
            };
        } catch (error) {
            return {
                valid: false,
                error: 'QR Code inválido'
            };
        }
    }

    // ========== COMPARTILHAMENTO VIA WEB SHARE API ==========

    // Compartilhar usando Web Share API (funciona em dispositivos móveis)
    async shareViaWebAPI(videoId) {
        try {
            const video = await VideoDB.getVideo(videoId);
            if (!video) throw new Error('Vídeo não encontrado');

            // Criar arquivo temporário
            const base64Data = video.data.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: video.type });
            const file = new File([blob], `${video.title}.mp4`, { type: video.type });

            // Usar Web Share API
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: video.title,
                    text: `Assista: ${video.title}`,
                    url: window.location.href
                });
                
                await this.logShare(videoId, 'web_share');
                return { success: true, method: 'web_share' };
            } else {
                // Fallback para download
                return this.exportVideo(videoId);
            }
        } catch (error) {
            console.error('Erro no Web Share:', error);
            throw error;
        }
    }

    // ========== SISTEMA DE CÓDIGOS DE COMPARTILHAMENTO ==========

    // Gerar código de compartilhamento único
    generateShareCode(videoId, expiresIn = 7 * 24 * 60 * 60 * 1000) { // 7 dias
        const code = this.generateCode(6); // 6 caracteres
        const expiry = Date.now() + expiresIn;
        
        const shareCode = {
            code,
            videoId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(expiry).toISOString(),
            uses: 0,
            maxUses: 10
        };
        
        // Salvar código
        this.shareCodes.set(code, shareCode);
        this.saveShareCodes();
        
        return {
            code,
            expiresAt: shareCode.expiresAt,
            shareUrl: `${window.location.origin}/share.html?code=${code}`
        };
    }

    // Usar código de compartilhamento
    async useShareCode(code) {
        const shareCode = this.shareCodes.get(code);
        
        if (!shareCode) {
            throw new Error('Código inválido');
        }
        
        // Verificar expiração
        if (new Date(shareCode.expiresAt) < new Date()) {
            this.shareCodes.delete(code);
            this.saveShareCodes();
            throw new Error('Código expirado');
        }
        
        // Verificar limite de usos
        if (shareCode.uses >= shareCode.maxUses) {
            this.shareCodes.delete(code);
            this.saveShareCodes();
            throw new Error('Código atingiu limite de usos');
        }
        
        // Incrementar usos
        shareCode.uses++;
        this.shareCodes.set(code, shareCode);
        this.saveShareCodes();
        
        // Buscar vídeo
        const video = await VideoDB.getVideo(shareCode.videoId);
        if (!video) {
            throw new Error('Vídeo não encontrado');
        }
        
        return {
            video,
            shareCode,
            remainingUses: shareCode.maxUses - shareCode.uses
        };
    }

    // ========== COMPARTILHAMENTO DIRETO VIA WEBRTC ==========

    // Inicializar WebRTC para compartilhamento P2P offline
    async initWebRTC() {
        try {
            // Configurar conexão WebRTC
            this.rtcConfig = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ],
                iceCandidatePoolSize: 10
            };
            
            // Criar canal de dados
            this.dataChannel = null;
            this.peerConnection = null;
            
            // Iniciar descoberta de pares na rede local
            this.startLocalDiscovery();
            
        } catch (error) {
            console.warn('WebRTC não disponível para compartilhamento offline:', error);
        }
    }

    // Descoberta de dispositivos na mesma rede
    startLocalDiscovery() {
        try {
            // Usar WebSockets ou WebRTC para descoberta local
            const discoveryChannel = new BroadcastChannel('videoshare-discovery');
            
            // Anunciar presença
            const announce = () => {
                discoveryChannel.postMessage({
                    type: 'announce',
                    deviceId: this.getDeviceId(),
                    deviceName: this.getDeviceName(),
                    timestamp: Date.now()
                });
            };
            
            // Ouvir anúncios
            discoveryChannel.onmessage = (event) => {
                if (event.data.type === 'announce' && event.data.deviceId !== this.getDeviceId()) {
                    this.handlePeerDiscovery(event.data);
                }
            };
            
            // Anunciar periodicamente
            announce();
            setInterval(announce, 30000);
            
        } catch (error) {
            console.warn('Descoberta local não disponível:', error);
        }
    }

    // Conectar com outro dispositivo
    async connectToPeer(peerId) {
        try {
            // Criar conexão WebRTC
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // Configurar canal de dados
            this.dataChannel = this.peerConnection.createDataChannel('videoshare');
            this.setupDataChannel(this.dataChannel);
            
            // Criar oferta
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Enviar oferta (em produção, usar servidor de sinalização)
            // Para offline, podemos usar QR Code com a oferta
            
            return {
                success: true,
                offer: offer,
                peerId: peerId
            };
            
        } catch (error) {
            console.error('Erro ao conectar:', error);
            throw error;
        }
    }

    // Enviar vídeo via WebRTC
    async sendVideoViaWebRTC(videoId, peerConnection) {
        const video = await VideoDB.getVideo(videoId);
        if (!video) throw new Error('Vídeo não encontrado');
        
        return new Promise((resolve, reject) => {
            if (!peerConnection || !this.dataChannel) {
                reject(new Error('Conexão não estabelecida'));
                return;
            }
            
            // Converter vídeo para chunks
            const base64Data = video.data.split(',')[1];
            const chunks = this.splitIntoChunks(base64Data, 16000); // 16KB por chunk
            
            // Enviar metadados primeiro
            const metadata = {
                type: 'video_transfer',
                videoId: video.id,
                title: video.title,
                totalChunks: chunks.length,
                totalSize: video.size,
                mimeType: video.type
            };
            
            this.dataChannel.send(JSON.stringify(metadata));
            
            // Enviar chunks
            let sentChunks = 0;
            const sendNextChunk = () => {
                if (sentChunks >= chunks.length) {
                    resolve({ success: true, chunks: sentChunks });
                    return;
                }
                
                if (this.dataChannel.readyState === 'open') {
                    this.dataChannel.send(chunks[sentChunks]);
                    sentChunks++;
                    
                    // Enviar próximo chunk com delay para não sobrecarregar
                    setTimeout(sendNextChunk, 10);
                } else {
                    reject(new Error('Canal de dados fechado'));
                }
            };
            
            sendNextChunk();
        });
    }

    // ========== UTILITÁRIOS ==========

    // Gerar ID único
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Gerar código
    generateCode(length = 6) {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Sanitizar nome de arquivo
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    // Dividir dados em chunks
    splitIntoChunks(data, chunkSize) {
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.substring(i, i + chunkSize));
        }
        return chunks;
    }

    // Hash de senha simples
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    // Obter ID do dispositivo
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + this.generateId(12);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }

    // Obter nome do dispositivo
    getDeviceName() {
        return localStorage.getItem('device_name') || 
               navigator.userAgentData?.brands[0]?.brand || 
               'Dispositivo';
    }

    // Salvar códigos de compartilhamento
    saveShareCodes() {
        const codes = Object.fromEntries(this.shareCodes);
        localStorage.setItem('share_codes', JSON.stringify(codes));
    }

    // Carregar códigos de compartilhamento
    async loadShareCodes() {
        try {
            const saved = localStorage.getItem('share_codes');
            if (saved) {
                const codes = JSON.parse(saved);
                // Filtrar códigos expirados
                const now = new Date();
                for (const [code, data] of Object.entries(codes)) {
                    if (new Date(data.expiresAt) > now) {
                        this.shareCodes.set(code, data);
                    }
                }
                this.saveShareCodes(); // Salvar sem os expirados
            }
        } catch (error) {
            console.warn('Erro ao carregar códigos:', error);
        }
    }

    // Log de compartilhamento
    async logShare(videoId, method) {
        try {
            const log = {
                videoId,
                method,
                timestamp: new Date().toISOString(),
                deviceId: this.getDeviceId()
            };
            
            // Salvar no histórico
            const history = JSON.parse(localStorage.getItem('share_history') || '[]');
            history.unshift(log);
            if (history.length > 100) history.pop(); // Limitar a 100 registros
            localStorage.setItem('share_history', JSON.stringify(history));
            
        } catch (error) {
            console.warn('Erro ao logar compartilhamento:', error);
        }
    }

    // Configurar canal de dados
    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('Canal de dados aberto');
        };
        
        channel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data);
        };
        
        channel.onerror = (error) => {
            console.error('Erro no canal de dados:', error);
        };
        
        channel.onclose = () => {
            console.log('Canal de dados fechado');
        };
    }

    // Manipular mensagens do canal de dados
    handleDataChannelMessage(data) {
        try {
            // Tentar parsear como JSON
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'video_transfer':
                    this.handleVideoTransfer(message);
                    break;
                case 'metadata':
                    this.handleMetadata(message);
                    break;
                default:
                    console.log('Mensagem recebida:', message);
            }
        } catch (error) {
            // Tratar como dados binários/chunk de vídeo
            this.handleVideoChunk(data);
        }
    }

    // Manipular transferência de vídeo
    handleVideoTransfer(metadata) {
        this.currentTransfer = {
            metadata,
            chunks: [],
            received: 0
        };
    }

    // Manipular chunk de vídeo
    handleVideoChunk(chunk) {
        if (!this.currentTransfer) return;
        
        this.currentTransfer.chunks.push(chunk);
        this.currentTransfer.received++;
        
        // Verificar se transferência está completa
        if (this.currentTransfer.received >= this.currentTransfer.metadata.totalChunks) {
            this.completeVideoTransfer();
        }
    }

    // Completar transferência de vídeo
    async completeVideoTransfer() {
        try {
            const transfer = this.currentTransfer;
            const videoData = transfer.chunks.join('');
            
            // Reconstruir vídeo
            const video = {
                id: this.generateId(),
                title: transfer.metadata.title,
                data: `data:${transfer.metadata.mimeType};base64,${videoData}`,
                type: transfer.metadata.mimeType,
                size: transfer.metadata.totalSize,
                duration: 0,
                importedAt: new Date().toISOString(),
                importedFrom: 'WebRTC Transfer'
            };
            
            // Salvar vídeo
            await VideoDB.saveVideo(video);
            
            // Notificar sucesso
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(JSON.stringify({
                    type: 'transfer_complete',
                    videoId: video.id,
                    success: true
                }));
            }
            
            // Limpar transferência atual
            this.currentTransfer = null;
            
            // Atualizar UI
            this.showNotification(`Vídeo "${video.title}" recebido com sucesso!`, 'success');
            
        } catch (error) {
            console.error('Erro ao completar transferência:', error);
            this.showNotification('Erro ao receber vídeo', 'error');
        }
    }

    // Mostrar notificação
    showNotification(message, type = 'info') {
        // Implementar notificação na UI
        if (window.showMessage) {
            window.showMessage(message, type);
        } else {
            alert(message);
        }
    }
}

// Exportar para uso global
const ShareManager = new OfflineShare();