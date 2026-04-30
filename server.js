const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static('public'));

// Os 10 principais ativos OTC da IQ Option e seus respectivos IDs
const IQ_ASSETS = {
    'EURUSD-OTC': 76, 'GBPUSD-OTC': 77, 'USDJPY-OTC': 78,
    'EURGBP-OTC': 79, 'USDCHF-OTC': 80, 'AUDUSD-OTC': 81,
    'NZDUSD-OTC': 82, 'USDCAD-OTC': 83, 'EURJPY-OTC': 84,
    'GBPJPY-OTC': 85
};

let iqSocket = null;

// Função mestre de conexão
function conectarIQOption() {
    console.log("Conectando ao núcleo de dados da IQ Option...");
    iqSocket = new WebSocket('wss://iqoption.com/echo/websocket');

    iqSocket.on('open', () => {
        console.log("✅ Conexão MTF (Multi-Timeframe) estabelecida!");
        
        // Solicita as velas de 1min (60s), 5min (300s) e 15min (900s) para TODOS os ativos
        Object.values(IQ_ASSETS).forEach(activeId => {
            [60, 300, 900].forEach(size => {
                iqSocket.send(JSON.stringify({
                    name: "subscribeMessage",
                    msg: { name: "candle-generated", params: { routingFilters: { active_id: activeId, size: size } } }
                }));
            });
        });
    });

    iqSocket.on('message', (data) => {
        const mensagem = JSON.parse(data);
        if (mensagem.name === 'candle-generated') {
            const v = mensagem.msg;
            
            // Mapeia o ID de volta para o Nome do Ativo (ex: 76 -> EURUSD-OTC)
            let nomeAtivo = Object.keys(IQ_ASSETS).find(key => IQ_ASSETS[key] === v.active_id);
            if(!nomeAtivo) return;

            const velaFormatada = {
                ativo: nomeAtivo,
                timeframe: v.size, // 60, 300 ou 900
                time: v.from,
                open: v.open, high: v.max, low: v.min, close: v.close,
                volume: v.volume // Tick volume
            };

            io.emit('nova_vela_mtf', velaFormatada);
        }
    });

    iqSocket.on('close', () => {
        console.log("❌ Conexão caiu. Reconectando em 5s...");
        setTimeout(conectarIQOption, 5000);
    });
}
conectarIQOption();

io.on('connection', (socket) => { console.log(`🟢 Usuário conectado.`); });
server.listen(process.env.PORT || 3000, () => console.log(`🚀 Motor Quântico OTC rodando...`));
