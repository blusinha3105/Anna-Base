const { getGroupConfig, updateGroupConfig } = require('../config/database');
const { settings, api, images, stickers } = require('../config/settings');
const { colors } = require('../utils/formatUtils');
const { delay, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getBuffer, fetchJson, upload, convertSticker, createExif } = require('../utils/utils');
const { ytmp3, ytmp4  } = require('../../plugins/scraper/ytdl');
const yts = require('yt-search');
const fetch = require('node-fetch');
const fs = require('fs');
const { Sticker } = require('../../plugins/sticker');

const cooldowns = new Map();
const COOLDOWN_TIME = 30 * 1000;
const TEST_AUTO_DELETE_TIME = 30;
const menuMessages = new Map();
const testMessages = new Map();

function extractMessageText(message) {
    if (!message || typeof message !== 'object') return '';
    return (
        message.conversation ||
        (message.extendedTextMessage?.text) ||
        (message.buttonsResponseMessage?.selectedButtonId) ||
        (message.listResponseMessage?.singleSelectReply?.selectedRowId) ||
        (message.imageMessage?.caption) ||
        (message.videoMessage?.caption) ||
        (message.documentMessage?.caption) ||
        ''
    );
}

const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin == 'admin') admins.push(i.id);
        if (i.admin == 'superadmin') admins.push(i.id);
    }
    return admins;
};

const getMembros = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin == null) admins.push(i.id);
    }
    return admins;
};

const getFileBuffer = async (mediakey, MediaType) => {
    const stream = await downloadContentFromMessage(mediakey, MediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
};

function getMenuNavigationText() {
    return '\n\n*Escolha outro menu:*\n' +
        'menu1 - Menu de Grupos\n' +
        'menu2 - Menu Básico\n' +
        'menu3 - Menu de Mídia\n' +
        'Responda com a palavra-chave (ex.: menu1)';
}

async function handleCommands(socket, messages) {
    try {
        const { messages: msgList } = messages;
        if (!msgList || !Array.isArray(msgList)) {
            console.log('Evento de mensagem inválido ou vazio');
            return;
        }

        for (const msg of msgList) {
            const info = msg;
            const chatId = msg.key?.remoteJid;
            if (!chatId) {
                console.log('Ignorando mensagem: chatId não definido');
                continue;
            }

            const text = extractMessageText(msg.message)?.trim() || '';
            console.log(`Mensagem recebida: chatId=${chatId}, text="${text}"`);

            const isGroup = chatId.endsWith('@g.us');
            const sender = isGroup ? (info.key.participant.includes(':') ? info.key.participant.split(':')[0] + '@s.whatsapp.net' : info.key.participant) : info.key.remoteJid;
            const botNumber = socket.user?.id?.split(':')[0] + '@s.whatsapp.net' || '';
            const pushname = info.pushName || 'Usuário';
            const isStatus = chatId.endsWith('@broadcast');

            if (isStatus) {
                console.log('Ignorando mensagem de status');
                continue;
            }

            let groupConfig;
            if (isGroup) {
                groupConfig = await getGroupConfig(chatId);
            } else {
                groupConfig = { prefix: settings.prefix };
            }

            const prefix = groupConfig.prefix || settings.prefix;
            const botName = settings.botName || 'Bot 2025';
            const NomeDoBot = botName.replace(/@/g, '');

            const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            if (quotedMessage && quotedMessageId && menuMessages.has(quotedMessageId)) {
                const menuData = menuMessages.get(quotedMessageId);
                if (menuData.sender !== sender) {
                    continue;
                }

                const option = text.toLowerCase();
                if (!['menu1', 'menu2', 'menu3'].includes(option)) {
                    await socket.sendMessage(chatId, { text: '🚫 Por favor, envie uma opção válida (menu1, menu2 ou menu3).', quote: msg });
                    continue;
                }

                let responseText = '';
                if (option === 'menu1') {
                    responseText = '👥 *Menu de Grupos*\n' +
                        '`!antifake [on/off]` - Ativa/desativa o sistema antifake.\n' +
                        '`!antilink [on/off]` - Ativa/desativa o sistema antilink.\n' +
                        '`!antilinkhard [on/off]` - Ativa/desativa o sistema antilinkhard.\n' +
                        '`!antiporno [on/off]` - Ativa/desativa o sistema antiporno.\n' +
                        '`!ban @user` - Bane um usuário do grupo.\n' +
                        '`!setup` - Configura a mensagem de boas-vindas.\n' +
                        '`!status` - Verifica o status do bot.\n' +
                        '`!poll [pergunta] | [opção1] | [opção2] | ...` - Cria uma enquete.';
                } else if (option === 'menu2') {
                    responseText = '📋 *Menu Básico*\n' +
                        '`!ping` - Verifica se o bot está online.\n' +
                        '`!menu` - Mostra este menu.\n' +
                        '`!dice` - Rola um dado virtual.\n' +
                        '`!shorten [url]` - Encurta uma URL.\n' +
                        '`!sticker` - Cria uma figurinha a partir de uma imagem ou vídeo.\n' +
                        '`!fsticker` - Cria uma figurinha (alternativa) a partir de uma imagem, vídeo ou figurinha.';
                } else if (option === 'menu3') {
                    responseText = '🎵 *Menu de Mídia*\n' +
                        '`!play [termo]` - Pesquisa e envia áudio do YouTube.\n' +
                        '`!ytmp3 [url]` - Baixa áudio de um vídeo do YouTube.\n' +
                        '`!play_video [termo]` - Pesquisa e envia vídeo do YouTube.\n' +
                        '`!ytmp4 [url]` - Baixa vídeo de um vídeo do YouTube.\n' +
                        '`!tiktok [url]` - Baixa vídeo do TikTok.\n' +
                        '`!tiktokmp3 [url]` - Baixa áudio de um vídeo do TikTok.';
                }

                responseText += getMenuNavigationText();

                await socket.sendMessage(chatId, {
                    image: { url: images.MenuImg },
                    caption: responseText,
                    edit: { remoteJid: chatId, id: quotedMessageId }
                });

                continue;
            }

            if (!text.startsWith(prefix)) {
                console.log(`Mensagem ignorada: não começa com o prefixo "${prefix}"`);
                continue;
            }

            const [command, ...args] = text.slice(prefix.length).trim().split(' ');
            const cmd = command.toLowerCase();
            const q = args.join(' ');
            const from = msg.key.remoteJid;

            console.log(`Comando identificado: ${cmd}, argumentos: "${q}", isGroup: ${isGroup}`);

            let groupMetadata, groupAdmins, isBotGroupAdmins, isGroupAdmins, groupMembers, groupName, groupDesc;
            if (isGroup) {
                groupMetadata = await socket.groupMetadata(chatId);
                groupAdmins = getGroupAdmins(groupMetadata.participants);
                isBotGroupAdmins = groupAdmins.includes(botNumber);
                isGroupAdmins = groupAdmins.includes(sender);
                groupMembers = groupMetadata.participants;
                groupName = groupMetadata.subject;
                groupDesc = groupMetadata.desc || '';
            }

            const dfndofc = settings.ownerNumber + '@s.whatsapp.net';
            const DonoOficial =
                dfndofc.includes(sender) ||
                settings.ownerNumber.includes(sender) ||
                settings.ownerNumber.includes(sender.split('@')[0] + '@s.whatsapp.net') ||
                settings.ownerNumber.includes(sender.split('@')[0] + '@c.us');
            if (isGroup) {
                isGroupAdmins = isGroupAdmins || DonoOficial;
            }

            if (!sender || typeof sender !== 'string') {
                console.log('Sender inválido:', sender);
                continue;
            }

            const selo = {
                key: { fromMe: false, participant: `0@s.whatsapp.net`, ...{} },
                message: {
                    contactMessage: {
                        displayName: pushname,
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;${pushname},;;;\nFN:${pushname}\nitem1.TEL;waid=${sender.split('@')[0]}:${sender.split('@')[0]}@s.whatsapp.net\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                    }
                }
            };

            async function reply(texto) {
                await socket.sendPresenceUpdate('composing', from);
                await delay(1000);
                await socket.sendMessage(from, { text: texto }, { quoted: selo });
            }

            async function reagir(idgp, emj) {
                await socket.sendMessage(idgp, { react: { text: emj, key: info.key } });
            }

            const commandKey = `${sender}:${cmd}`;
            const now = Date.now();
            if (['play', 'ytmp3', 'play_video', 'ytmp4', 'tiktok', 'tiktokmp3', 'sticker', 'fig', 'fsticker', 'fstiker', 'f'].includes(cmd)) {
                const lastUsed = cooldowns.get(commandKey) || 0;
                const timeLeft = (lastUsed + COOLDOWN_TIME - now) / 1000;
                if (timeLeft > 0) {
                    await reply(`⏳ Por favor, espere ${timeLeft.toFixed(1)} segundos antes de usar o comando !${cmd} novamente.`);
                    continue;
                }
                cooldowns.set(commandKey, now);
            }

            switch (cmd) {
                case 'ping':
                    await reply('🏓 Pong!');
                    break;

                case 'menu':
                    const menuText = '🤖 *Menu Interativo*\n' +
                        'menu1 - Menu de Grupos\n' +
                        'menu2 - Menu Básico\n' +
                        'menu3 - Menu de Mídia\n' +
                        'Responda com a palavra-chave (ex.: menu1)';
                    const menuMsg = await socket.sendMessage(chatId,{image: {url: images.MenuImg}, caption: menuText}, { quoted: selo });
                    menuMessages.set(menuMsg.key.id, { chatId, sender });
                    break;

                case 'autoDelete':// powered by GleysonDevs Oficial
                    if (isGroup && !isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para usar o comando !teste em grupos, pois ele precisa deletar mensagens.');
                        continue;
                    }

                    const testText = '🔔 Esta é uma mensagem de teste!\n' +
                        `⏳ Esta mensagem será deletada em ${TEST_AUTO_DELETE_TIME} segundos.`;
                    const testMsg = await socket.sendMessage(chatId, { text: testText }, { quoted: selo });

                    testMessages.set(testMsg.key.id, { chatId });

                    setTimeout(async () => {
                        try {
                            await socket.sendMessage(chatId, {
                                delete: {
                                    remoteJid: chatId,
                                    id: testMsg.key.id,
                                    fromMe: true
                                }
                            });
                            testMessages.delete(testMsg.key.id);
                        } catch (error) {
                            console.error(`Erro ao deletar mensagem de teste: ${error.message}`);
                            await socket.sendMessage(chatId, { text: '❌ Erro ao deletar a mensagem de teste.' });
                        }
                    }, TEST_AUTO_DELETE_TIME * 1000);
                    break;// Powered by GleysonDevs Oficial

                case 'st':
                case 'stk':
                case 'sticker':
                case 's':
                    try {
                        const auc = info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                            info.message?.imageMessage ||
                            info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessageV2?.message?.imageMessage ||
                            info.message?.viewOnceMessageV2?.message?.imageMessage ||
                            info.message?.viewOnceMessage?.message?.imageMessage ||
                            info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message?.imageMessage;

                        const aoc = info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
                            info.message?.videoMessage ||
                            info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessageV2?.message?.videoMessage ||
                            info.message?.viewOnceMessageV2?.message?.videoMessage ||
                            info.message?.viewOnceMessage?.message?.videoMessage ||
                            info.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message?.videoMessage;

                        const errorMessage = `🚫 *Anna Base by GleysonDevs*\n\nMencione ou envie uma imagem ou vídeo!\n\n→ *Opções de Customização*:\n\t- Círculo: *${prefix}${command} -circle* | *-cl*\n\t- Pirâmide: *${prefix}${command} -piramide* | *-pr*\n\t- Borda Circular: *${prefix}${command} -borda* | *-bd*\n\t- Prisma: *${prefix}${command} -prisma* | *-pm*\n\n→ *Observações*:\n\t- Customizações só funcionam para imagens.\n\t- Vídeos animados não suportam formatos customizados (círculo, pirâmide, etc.).\n\t- Limite de duração para vídeos animados: *9.9s*.\n\n> ${NomeDoBot}`;

                        if (!auc && !aoc) {
                            await reply(errorMessage);
                            break;
                        }

                        const sticker = new Sticker();

                        const metadata = {
                            pack: stickers.packName || 'GleysonDevs',
                            author: stickers.authorName || 'GleysonDevs',
                            emojis: ['🤠', '🥶', '😻']
                        };

                        await reply('⏳ *Anna Base* | Criando sua figurinha...');

                        if (auc) {
                            const fileBuffer = await getFileBuffer(auc, 'image');

                            if (args[0] === '-circle' || args[0] === '-cl') {
                                sticker.options.edit = 'circle';
                            } else if (args[0] === '-borda' || args[0] === '-bd') {
                                sticker.options.edit = 'borda';
                            } else if (args[0] === '-piramide' || args[0] === '-pr' || args[0] === '-pyramid') {
                                sticker.options.edit = 'piramide';
                            } else if (args[0] === '-prisma' || args[0] === '-pm') {
                                sticker.options.edit = 'prisma';
                            } else if (args.length > 0) {
                                await reply(errorMessage);
                                break;
                            }

                            sticker.addFile(fileBuffer);
                            sticker.options.metadata = metadata;

                            const data = await sticker.start();
                            await socket.sendMessage(from, { sticker: fs.readFileSync(data[0].value) }, { quoted: info });

                            setTimeout(async () => {
                                await reagir(from, "✅️");
                                await fs.unlinkSync(data[0].value);
                            }, 20);
                        } else if (aoc) {
                            if (aoc.seconds > 10) {
                                await reply(`🚫 *Anna Base by GleysonDevs*\n\nO vídeo deve ter no máximo 9.9 segundos para ser convertido em figurinha animada!\n\n> ${NomeDoBot}`);
                                break;
                            }

                            if (args[0] === '-circle' || args[0] === '-cl' ||
                                args[0] === '-borda' || args[0] === '-bd' ||
                                args[0] === '-piramide' || args[0] === '-pr' || args[0] === '-pyramid' ||
                                args[0] === '-prisma' || args[0] === '-pm') {
                                await reply(`🚫 *Anna Base by GleysonDevs*\n\nCustomizações como círculo, borda, pirâmide e prisma não são suportadas para vídeos animados!\n\n> ${NomeDoBot}`);
                                break;
                            } else if (args.length > 0) {
                                await reply(errorMessage);
                                break;
                            }

                            const fileBuffer = await getFileBuffer(aoc, 'video');
                            sticker.addFile(fileBuffer);
                            sticker.options.metadata = metadata;

                            const data = await sticker.start();
                            await socket.sendMessage(from, { sticker: fs.readFileSync(data[0].value) }, { quoted: info });

                            setTimeout(async () => {
                                await reagir(from, "✅️");
                                await fs.unlinkSync(data[0].value);
                            }, 20);
                        }
                    } catch (error) {
                        console.error(`Erro ao criar figurinha: ${error.message}`);
                        await reply(`❌ *Anna Base by GleysonDevs*\n\nErro ao criar a figurinha: ${String(error)}.\nTente novamente!\n\n> ${NomeDoBot}`);
                    }
                    break;

                case 'antifake':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para executar este comando!');
                        continue;
                    }
                    if (!isGroupAdmins) {
                        await reply('🚫 Apenas admins podem usar este comando!');
                        continue;
                    }
                    const newAntifake = args[0]?.toLowerCase() === 'on';
                    await updateGroupConfig(chatId, { ...groupConfig, antifake: newAntifake });
                    await reply(`✅ Antifake ${newAntifake ? 'on' : 'off'}!`);
                    break;

                case 'antilink':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para executar este comando!');
                        continue;
                    }
                    if (!isGroupAdmins) {
                        await reply('🚫 Apenas admins podem usar este comando!');
                        continue;
                    }
                    const newAntilink = args[0]?.toLowerCase() === 'on';
                    await updateGroupConfig(chatId, { ...groupConfig, antilink: newAntilink });
                    await reply(`✅ Antilink ${newAntilink ? 'on' : 'off'}!`);
                    break;

                case 'antilinkhard':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para executar este comando!');
                        continue;
                    }
                    if (!isGroupAdmins) {
                        await reply('🚫 Apenas admins podem usar este comando!');
                        continue;
                    }
                    const newAntilinkHard = args[0]?.toLowerCase() === 'on';
                    await updateGroupConfig(chatId, { ...groupConfig, antilinkhard: newAntilinkHard });
                    await reply(`✅ Antilinkhard ${newAntilinkHard ? 'on' : 'off'}!`);
                    break;

                case 'antiporno':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para executar este comando!');
                        continue;
                    }
                    if (!isGroupAdmins) {
                        await reply('🚫 Apenas admins podem usar este comando!');
                        continue;
                    }
                    const newAntiporno = args[0]?.toLowerCase() === 'on';
                    await updateGroupConfig(chatId, { ...groupConfig, antiporno: newAntiporno });
                    await reply(`✅ Antiporno ${newAntiporno ? 'on' : 'off'}!`);
                    break;

                case 'ban':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!isBotGroupAdmins) {
                        await reply('🚫 O bot precisa ser admin para executar este comando!');
                        continue;
                    }
                    if (!isGroupAdmins) {
                        await reply('🚫 Apenas admins podem usar este comando!');
                        continue;
                    }
                    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    if (!mentioned.length) {
                        await reply('🚫 Mencione um usuário!');
                        continue;
                    }
                    await socket.groupParticipantsUpdate(chatId, mentioned, 'remove');
                    await reply('🚫 Banido(s)!');
                    break;

                case 'setup':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    await updateGroupConfig(chatId, {
                        ...groupConfig,
                        welcome_enabled: true,
                        welcome_message: 'Bem-vindo(a) ao grupo!',
                    });
                    await reply('✅ Boas-vindas configuradas!');
                    break;

                case 'status':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    const isAdminStatus = groupMetadata.participants.some(p => p.id === socket.user.id && p.admin);
                    await reply(`🤖 *Status*\nAdmin: ${isAdminStatus ? 'Sim' : 'Não'}\nConectado: Sim`);
                    break;

                case 'play':
                case 'ytmp3':
                    try {
                        if (cmd === 'play') {
                            if (!q) {
                                await reply('🚫 Digite algo para enviar!');
                                continue;
                            }
                            const textinho = q;
                            await reply(`🔍 Pesquisando por: ${textinho}`);
                            const searchUrl = await yts(textinho);
                            const ABC = searchUrl.all[0];
                            if (!ABC || !ABC.url) {
                                await reply('🚫 Não consegui encontrar nada!');
                                continue;
                            }
                            const hasil = `* *titulo:* ${ABC.title}\n` +
                                `* *url:* ${ABC.url}\n` +
                                `* *time:* ${ABC.timestamp}\n` +
                                `* *views:* ${ABC.views}\n`;
                            await socket.sendMessage(chatId, { image: { url: ABC.thumbnail }, caption: hasil }, { quoted: selo });
                            await reply('🔊 Enviando áudio...');
                            ytmp3(ABC.url)
                              .then(result => {
                                 console.log("ytmp3 result:", result);
                                 socket.sendMessage(chatId, { audio: { url: result.download.url }, mimetype: 'audio/mpeg' }, { quoted: selo });
                                })
                              .catch(error => {
                                 console.error("ytmp3 error:", error);

                                });
                           // await socket.sendMessage(chatId, { audio: { url: audioUrl }, mimetype: 'audio/mpeg' }, { quoted: selo });
                        } else if (cmd === 'ytmp3') {
                            if (!q) {
                                await reply('🚫 Digite algo para enviar!');
                                continue;
                            }
                            const textinho = q;
                            await reply('🔊 Enviando áudio...');
                            ytmp3(textinho)
                              .then(result => {
                                 console.log("ytmp3 result:", result);
                                socket.sendMessage(chatId, { audio: { url: result.download.url }, mimetype: 'audio/mpeg' }, { quoted: selo });
                                })
                              .catch(error => {
                                 console.error("ytmp3 error:", error);

                                });
                        }
                    } catch (error) {
                        console.error(`Erro ao processar o comando play/ytmp3: ${error.message}`);
                        await reply(`❌ Erro ao processar o comando play/ytmp3. ${error}`);
                    }
                    break;

                case 'play_video':
                case 'ytmp4':
                    try {
                        if (cmd === 'play_video') {
                            if (!q) {
                                await reply('🚫 Digite algo para enviar!');
                                continue;
                            }
                            const textinho = q;
                            await reply(`🔍 Pesquisando por: ${textinho}`);
                            const searchUrl = await yts(textinho);
                            const ABC = searchUrl.all[0];
                            if (!ABC || !ABC.url) {
                                await reply('🚫 Não consegui encontrar nada!');
                                continue;
                            }
                            const hasil = `* *titulo:* ${ABC.title}\n` +
                                `* *url:* ${ABC.url}\n` +
                                `* *time:* ${ABC.timestamp}\n` +
                                `* *views:* ${ABC.views}\n`;
                            await reply('🔊 Enviando vídeo...');
                           ytmp4(ABC.url)
                                .then(result => {
                                    console.log("ytmp4 result:", result);
                                    socket.sendMessage(chatId, { video: { url: result.download.url }, caption: hasil, mimetype: 'video/mp4' }, { quoted: selo });
                                })
                                .catch(error => {
                                    console.error("ytmp4 error:", error);
                                });
                        } else if (cmd === 'ytmp4') {
                            if (!q) {
                                await reply('🚫 Digite algo para enviar!');
                                continue;
                            }
                            const textinho = q;
                            await reply('🔊 Enviando vídeo...');
                            ytmp4(textinho)
                                .then(result => {
                                    console.log("ytmp4 result:", result);
                                    socket.sendMessage(chatId, { video: { url: result.download.url }, caption: hasil, mimetype: 'video/mp4' }, { quoted: selo });
                                })
                                .catch(error => {
                                    console.error("ytmp4 error:", error);
                                });
                        }
                    } catch (error) {
                        console.error(`Erro ao processar o comando play_video/ytmp4: ${error.message}`);
                        await reply('❌ Erro ao processar o comando play_video/ytmp4. Tente novamente.');
                    }
                    break;

                case 'tiktok':
                case 'tiktokmp3':
                    try {
                        if (cmd === 'tiktok') {
                            const urlinha = q;
                            if (!urlinha) {
                                await reply('🚫 Me envie uma URL do TikTok!');
                                continue;
                            }
                            await reply(`🔍 Pesquisando por: ${urlinha}`);
                            const searchUrl = await fetchJson(api.url + `/api/download/tiktok?url=${urlinha}&apikey=` + api.key);
                            const ABC = searchUrl.resultado;
                            await delay(1000);
                            const hasil = `> TIKTOK ANNA - BASED\n` +
                                `* *descrição:* ${ABC.description}\n` +
                                `* *author:* ${ABC.author.username}\n` +
                                `* *comentarios:* ${ABC.statistics.commentCount}\n` +
                                `* *likes:* ${ABC.statistics.diggCount}\n` +
                                `* *shares:* ${ABC.statistics.shareCount}\n` +
                                `* *downloads:* ${ABC.statistics.downloadCount}\n`;
                            await reply('🔊 Enviando vídeo...');
                            await socket.sendMessage(chatId, { video: { url: ABC.video.playAddr[0] }, caption: hasil, mimetype: 'video/mp4' }, { quoted: selo });
                        } else if (cmd === 'tiktokmp3') {
                            const urlinha = q;
                            if (!urlinha) {
                                await reply('🚫 Me envie uma URL do TikTok!');
                                continue;
                            }
                            await reply(`🔍 Pesquisando por: ${urlinha}`);
                            const searchUrl = await fetchJson(api.url + `/api/download/tiktok?url=${urlinha}&apikey=` + api.key);
                            const ABC = searchUrl.resultado;
                            await delay(1000);
                            const hasil = `> TIKTOK ANNA - BASED\n` +
                                `* *descrição:* ${ABC.description}\n` +
                                `* *author:* ${ABC.author.username}\n` +
                                `* *comentarios:* ${ABC.statistics.commentCount}\n` +
                                `* *likes:* ${ABC.statistics.diggCount}\n` +
                                `* *shares:* ${ABC.statistics.shareCount}\n` +
                                `* *downloads:* ${ABC.statistics.downloadCount}\n`;
                            await socket.sendMessage(chatId, { image: { url: ABC.video.cover[0] }, caption: hasil }, { quoted: selo });
                            await reply('🔊 Enviando áudio...');
                            await socket.sendMessage(chatId, { audio: { url: ABC.video.playAddr[0] }, mimetype: 'audio/mpeg' }, { quoted: selo });
                        }
                    } catch (error) {
                        console.error(`Erro ao processar o comando tiktok/tiktokmp3: ${error.message}`);
                        await reply('❌ Erro ao processar o comando tiktok/tiktokmp3. Tente novamente.');
                    }
                    break;

                case 'poll':
                    if (!isGroup) {
                        await reply('🚫 Este comando só pode ser usado em grupos!');
                        continue;
                    }
                    if (!q) {
                        await reply('🚫 Uso: !poll [pergunta] | [opção1] | [opção2] | ...');
                        continue;
                    }
                    const pollParts = q.split('|').map(part => part.trim());
                    if (pollParts.length < 3) {
                        await reply('🚫 A enquete precisa de uma pergunta e pelo menos 2 opções!');
                        continue;
                    }
                    const question = pollParts[0];
                    const options = pollParts.slice(1);
                    if (options.length > 10) {
                        await reply('🚫 Limite de 10 opções por enquete!');
                        continue;
                    }
                    const pollMessage = {
                        text: `📊 *Enquete*: ${question}\n` +
                            options.map((opt, index) => `${index + 1}. ${opt}`).join('\n') +
                            '\nResponda com o número da opção (ex.: 1)',
                    };
                    await socket.sendMessage(chatId, pollMessage, { quoted: selo });
                    break;

                case 'dice':
                    const diceResult = Math.floor(Math.random() * 6) + 1;
                    await reply(`🎲 Você rolou um dado e tirou: *${diceResult}*!`);
                    break;

                case 'shorten':
                    if (!q) {
                        await reply('🚫 Uso: !shorten [url]');
                        continue;
                    }
                    try {
                        const response = await fetch(`https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(q)}`);
                        const data = await response.json();
                        if (data.ok) {
                            const shortUrl = data.result.full_short_link;
                            await reply(`🔗 URL encurtada: ${shortUrl}`);
                        } else {
                            await reply('❌ Erro ao encurtar a URL. Verifique se a URL é válida.');
                        }
                    } catch (error) {
                        console.error(`Erro ao encurtar URL: ${error.message}`);
                        await reply('❌ Erro ao encurtar a URL. Tente novamente.');
                    }
                    break;

                default:
                    await reply('❓ Comando desconhecido. Use !menu para ver os comandos disponíveis.');
                    break;
            }
        }
    } catch (error) {
        console.error(`Erro ao processar: ${error.message || 'Erro desconhecido'}`);
        try {
            const chatId = messages?.messages?.[0]?.key?.remoteJid;
            if (chatId) {
                await socket.sendMessage(chatId, { text: '❌ Erro no comando. Tente novamente.' });
            }
        } catch (sendError) {
            console.error(`Erro ao enviar mensagem: ${sendError.message || 'Desconhecido'}`);
        }
    }
}

module.exports = { handleCommands };