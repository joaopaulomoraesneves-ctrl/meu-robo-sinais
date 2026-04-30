const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static('public'));

const IQ_ASSETS = {
    'EURUSD-OTC': 76, 'GBPUSD-OTC': 77, 'USDJPY-OTC': 78,
    'EURGBP-OTC': 79, 'USDCHF-OTC': 80, 'AUDUSD-OTC': 81,
    'NZDUSD-OTC': 82, 'USDCAD-OTC': 83, 'EURJPY-OTC': 84,
    'GBPJPY-OTC': 85
};

let iqSocket = null;

function conectarIQOption() {
    console.log("Colocando disfarce e conectando à IQ Option...");
    
    // O Disfarce (Headers) para a IQ Option não bloquear o servidor na nuvem
    iqSocket = new WebSocket('wss://iqoption.com/echo/websocket', {
        headers: {
            'Origin': 'https://iqoption.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    iqSocket.on('open', () => {
        console.log("✅ Conexão MTF estabelecida e disfarçada com sucesso!");
        
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
            let nomeAtivo = Object.keys(IQ_ASSETS).find(key => IQ_ASSETS[key] === v.active_id);
            if(!nomeAtivo) return;

            const velaFormatada = {
                ativo: nomeAtivo, timeframe: v.size, time: v.from,
                open: v.open, high: v.max, low: v.min, close: v.close, volume: v.volume
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

io.on('connection', (socket) => { console.log(`🟢 Usuário acessou o site.`); });
server.listen(process.env.PORT || 3000, () => console.log(`🚀 Motor Quântico OTC rodando...`));
