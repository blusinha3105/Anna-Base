const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const util = require('util');
const { colors } = require('./utils/formatUtils');
const { handleGroupEvents, handleGroupParticipantsUpdate } = require('./modules/groupEvents');
const { handleCommands } = require('./modules/commands');
const { initDatabase } = require('./config/database');
const NodeCache = require('node-cache');

const silentLogger = pino({ level: 'silent' });

const msgRetryCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const QR_CODE_PATH = './database/qr-code';
const usePairingCode = process.argv.includes('--sim');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const originalConsoleInfo = console.info;
console.info = function (...args) {
  const message = util.format(...args);
  if (
    message.includes('Closing stale open session') ||
    message.includes('Closing session: SessionEntry') ||
    message.includes('loading from store') ||
    message.includes('updated cache')
  ) {
    return;
  }
  originalConsoleInfo.apply(console, args);
};

function collectNumbers(input) {
  return input.replace(/\D/g, '');
}

async function startBot() {
  try {
    await initDatabase();
    const { state, saveCreds } = await useMultiFileAuthState(QR_CODE_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      logger: silentLogger, 
      printQRInTerminal: !usePairingCode,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
      msgRetryCounterCache: msgRetryCache,
      generateHighQualityLinkPreview: true,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message?.interactiveMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
    });

    if (usePairingCode && !socket.authState.creds.registered) {
      console.log(colors.green('⚠️ Modo de emparelhamento por código.'));
      const phoneNumber = await question(colors.cyan('📱 Insira o número (ex.: +556599999999): '));
      const cleanedNumber = collectNumbers(phoneNumber);
      if (!cleanedNumber || cleanedNumber.length < 10) {
        throw new Error('Número inválido.');
      }
      try {
        const code = await socket.requestPairingCode(cleanedNumber);
        console.log(colors.green('🔑 Código: ') + code);
      } catch (error) {
        console.error(`Erro ao gerar código: ${error.message || error}`);
        process.exit(1);
      }
      rl.close();
    }

    socket.ev.process(async (events) => {
      if (events['connection.update']) {
        const { connection, lastDisconnect } = events['connection.update'];
        if (connection === 'close') {
          console.error(`Conexão fechada: ${lastDisconnect?.error?.output?.statusCode || 'Desconhecido'}`);
          startBot();
        } else if (connection === 'open') {
          console.log(colors.green('✓ Bot conectado!'));
          await socket.sendPresenceUpdate('available');
          setInterval(async () => await socket.sendPresenceUpdate('available'), 30000);
        }
      }

      if (events['group-participants.update']) {
        await handleGroupParticipantsUpdate(socket, events['group-participants.update']);
      }

      if (events['messages.upsert']) {
        await handleCommands(socket, events['messages.upsert']);
        await handleGroupEvents(socket, events['messages.upsert']);
      }

      if (events['creds.update']) {
        await saveCreds();
      }
    });
  } catch (error) {
    console.error(`Erro ao iniciar: ${error.message || error}`);
    process.exit(1);
  }
}

startBot();
