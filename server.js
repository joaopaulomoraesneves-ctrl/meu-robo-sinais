const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const axios = require('axios'); // Necessário para o Telegram

chromium.use(stealth);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// Variável Global do Navegador (Evita vazamento de memória)
let globalBrowser = null;

// Liga o navegador principal uma única vez quando o servidor inicia
async function iniciarMotor() {
    console.log("Iniciando motor do navegador invisível...");
    globalBrowser = await chromium.launch({ headless: true });
    console.log("✅ Motor pronto e aguardando ordens.");
}
iniciarMotor();

io.on('connection', (socket) => {
    console.log(`🟢 Usuário conectado no Painel Web: ${socket.id}`);

    // Recebe configurações do Telegram para enviar mensagens
    socket.on('config_telegram', (config) => {
        socket.telegramData = config; // Salva os dados na sessão do usuário
    });

    socket.on('enviar_ordem', async (dadosOrdem) => {
        socket.emit('notificacao', { tipo: 'normal', msg: `[Servidor] Analisando execução de R$ ${dadosOrdem.valor}...` });
        
        try {
            await executarAutomacao(dadosOrdem, socket);
        } catch (erro) {
            console.error(erro);
            socket.emit('notificacao', { tipo: 'error', msg: `Erro na execução: ${erro.message}` });
        }
    });
});

async function executarAutomacao(dados, socket) {
    if (!globalBrowser) {
        socket.emit('notificacao', { tipo: 'error', msg: `Motor do navegador ainda está iniciando. Tente novamente em segundos.` });
        return;
    }

    // Abre apenas uma "Aba" nova, usando pouquíssima RAM
    const context = await globalBrowser.newContext();
    const page = await context.newPage();

    try {
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Acessando a corretora e disfarçando conexão...` });
        
        // Simulação de navegação (Substitua pela URL real futuramente)
        await page.goto('https://www.google.com'); 
        await page.waitForTimeout(1000); 
        
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Inserindo valor de R$ ${dados.valor}...` });
        await page.waitForTimeout(1500);

        const msgSucesso = `Ordem de R$ ${dados.valor} em ${dados.direcao} (${dados.ativo}) executada com sucesso!`;
        
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Clicou no botão de ${dados.direcao} com sucesso!` });
        socket.emit('resultado_ordem', { status: 'sucesso', msg: msgSucesso });

        // Envia para o Telegram se estiver configurado
        enviarSinalTelegram(socket.telegramData, msgSucesso);

    } finally {
        await context.close(); // Fecha a aba e limpa a memória na hora
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Aba fechada. Sessão finalizada.` });
    }
}

// Lógica Real do Bot do Telegram
function enviarSinalTelegram(tgData, mensagem) {
    if (!tgData || !tgData.token || !tgData.chatId) return;
    
    const url = `https://api.telegram.org/bot${tgData.token}/sendMessage`;
    axios.post(url, {
        chat_id: tgData.chatId,
        text: `🤖 *AutoTrade IA Avisa:*\n\n${mensagem}`,
        parse_mode: 'Markdown'
    }).then(() => console.log('Telegram enviado com sucesso!'))
      .catch(err => console.error('Erro ao enviar Telegram. Verifique as credenciais.'));
}

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`🚀 Servidor rodando na porta ${PORTA}`);
});
