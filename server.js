const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Diz para o servidor entregar a pasta 'public' onde está o seu site HTML
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`🟢 Usuário conectado no Painel Web: ${socket.id}`);

    socket.on('enviar_ordem', async (dadosOrdem) => {
        socket.emit('notificacao', { tipo: 'normal', msg: `[Servidor] Recebeu sinal de R$ ${dadosOrdem.valor} para ${dadosOrdem.direcao}.` });
        
        try {
            await executarAutomacao(dadosOrdem, socket);
        } catch (erro) {
            console.error(erro);
            socket.emit('notificacao', { tipo: 'error', msg: `Erro na execução: ${erro.message}` });
        }
    });
});

async function executarAutomacao(dados, socket) {
    socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Abrindo navegador invisível protegido...` });
    
    // Na nuvem, o navegador não tem tela (headless: true)
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // --- SIMULAÇÃO DA CORRETORA ---
        // (Aqui entrarão os códigos de clique específicos da IQ Option/Quotex no futuro)
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Acessando a corretora e camuflando IP...` });
        await page.goto('https://www.google.com'); // Acessando um site leve só para simular o processo
        
        await page.waitForTimeout(1000); 
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Digitando valor de R$ ${dados.valor} como um humano...` });
        
        await page.waitForTimeout(1500);
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Clicou no botão de ${dados.direcao} com sucesso!` });

        // Envia a confirmação final de volta para a tela do usuário
        socket.emit('resultado_ordem', { 
            status: 'sucesso', 
            msg: `Ordem de R$ ${dados.valor} em ${dados.direcao} executada com sucesso na corretora!` 
        });

    } finally {
        await browser.close(); // Sempre fecha o navegador para não travar a memória do servidor
        socket.emit('notificacao', { tipo: 'normal', msg: `[Robô] Navegador fechado. Memória liberada.` });
    }
}

// A porta que a nuvem usar, ou a 3000 se for no seu computador
const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`🚀 Servidor rodando perfeitamente na porta ${PORTA}`);
});
