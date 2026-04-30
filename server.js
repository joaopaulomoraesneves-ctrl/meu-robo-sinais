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
let heartbeatInterval = null;

function conectarIQOption() {
    console.log("Conectando à IQ Option com protocolo de visitante...");
    
    iqSocket = new WebSocket('wss://iqoption.com/echo/websocket', {
        headers: {
            'Origin': 'https://iqoption.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });

    iqSocket.on('open', () => {
        console.log("✅ Conexão estabelecida! Autenticando como visitante...");
        
        // O SEGREDO QUE FALTAVA: Autenticação anônima obrigatória
        iqSocket.send(JSON.stringify({ name: "ssid", msg: "" }));

        // Ping a cada 20 segundos para a IQ Option não derrubar o nosso servidor
        heartbeatInterval = setInterval(() => {
            if (iqSocket.readyState === WebSocket.OPEN) {
                iqSocket.send(JSON.stringify({ name: "heartbeat", msg: { heartbeatTime: Date.now() } }));
            }
        }, 20000);

        // Espera 2 segundos após entrar para pedir os gráficos educadamente
        setTimeout(() => {
            Object.values(IQ_ASSETS).forEach(activeId => {
                [60, 300, 900].forEach(size => {
                    iqSocket.send(JSON.stringify({
                        name: "subscribeMessage",
                        msg: { name: "candle-generated", params: { routingFilters: { active_id: activeId, size: size } } }
                    }));
                });
            });
            console.log("📡 Inscrição nos gráficos enviada para a corretora.");
        }, 2000); 
    });

    iqSocket.on('message', (data) => {
        const strData = data.toString();
        const mensagem = JSON.parse(strData);
        
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
        console.log("❌ Conexão com IQ Option caiu. Reconectando em 5s...");
        clearInterval(heartbeatInterval);
        setTimeout(conectarIQOption, 5000);
    });

    iqSocket.on('error', (err) => {
        console.error("Erro no WebSocket da IQ:", err.message);
    });
}

conectarIQOption();

io.on('connection', (socket) => { console.log(`🟢 Usuário acessou o site.`); });
server.listen(process.env.PORT || 3000, () => console.log(`🚀 Motor Quântico OTC rodando...`));
