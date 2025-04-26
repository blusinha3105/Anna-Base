const { getGroupAdmins } = require('../utils/utils');
const { getGroupConfig, updateGroupConfig } = require('../config/database');

const linkRegex = /https?:\/\/[^\s]+/i;

const allowedLinkRegex = /https?:\/\/(www\.)?(instagram\.com|instagr\.am|facebook\.com|fb\.me|tiktok\.com|vm\.tiktok\.com|youtube\.com|youtu\.be)/i;

const pornoKeywords = [
    'xxx', 'sexo', 'nudes', 'putaria', 'safada', 'safado',
    'erotic', 'hot', 'sexy', 'nude', '18+', 'proibido',
];

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

function isPornographic(message) {
    const text = extractMessageText(message).toLowerCase();
    const hasPornoText = pornoKeywords.some(keyword => text.includes(keyword));
    const hasMedia = !!(message.imageMessage || message.videoMessage);
    const isPorno = hasPornoText || (hasMedia && text.includes('18+'));
    console.log(`Verificação antiporno: hasPornoText=${hasPornoText}, hasMedia=${hasMedia}, text="${text}", isPorno=${isPorno}`);
    return isPorno;
}

async function handleGroupEvents(socket, event) {
    try {
        const { messages } = event;
        if (!messages || !Array.isArray(messages)) {
            console.log('Evento de mensagem inválido ou vazio');
            return;
        }

        for (const msg of messages) {
            const chatId = msg.key?.remoteJid;
            if (!chatId) {
                console.log('Ignorando mensagem: chatId não definido');
                continue;
            }

            const isGroup = chatId.endsWith('@g.us');
            const text = extractMessageText(msg.message)?.trim() || '';
            const sender = msg.key.participant || msg.key.remoteJid;

            console.log(`Mensagem recebida: chatId=${chatId}, isGroup=${isGroup}, sender=${sender}, text="${text}"\n`);

         
            if (isGroup) {
                const groupConfig = await getGroupConfig(chatId);
                const groupMetadata = await socket.groupMetadata(chatId);
                const groupAdmins = getGroupAdmins(groupMetadata.participants);
                const botNumber = socket.user?.id?.split(':')[0] + '@s.whatsapp.net' || '';
                console.log(`BotNumber: ${botNumber}, Sender: ${sender}, GroupAdmins: ${groupAdmins}`);

                const isBotGroupAdmin = groupAdmins.includes(botNumber);
                const isSenderAdmin = groupAdmins.includes(sender);
                if (sender === botNumber) {
                    console.log(`Ignorando mensagem do próprio bot: ${sender}`);
                    continue;
                }

                if (groupConfig.antilink && linkRegex.test(text)) {
                    if (allowedLinkRegex.test(text)) {
                        console.log(`Link permitido detectado em ${chatId} por ${sender}: ${text}`);
                        continue;
                    }
                    console.log(`Link não permitido detectado em ${chatId} por ${sender}: ${text}`);
                    await socket.sendMessage(chatId, { delete: msg.key });
                    await socket.sendMessage(chatId, { text: '🚫 Link detectado e removido!' });
                    continue;
                }

                if (groupConfig.antilinkhard && linkRegex.test(text)) {
                    if (allowedLinkRegex.test(text)) {
                        console.log(`Link permitido (hard) detectado em ${chatId} por ${sender}: ${text}`);
                        continue;
                    }
                    console.log(`Link não permitido (hard) detectado em ${chatId} por ${sender}: ${text}`);
                    await socket.sendMessage(chatId, { delete: msg.key });
                    if (isBotGroupAdmin) {
                        if (isSenderAdmin) {
                            await socket.sendMessage(chatId, { text: '🚫 Link detectado! Como você é admin, não será banido.' });
                        } else {
                            await socket.groupParticipantsUpdate(chatId, [sender], 'remove');
                            await socket.sendMessage(chatId, { text: '🚫 Link detectado! Usuário banido!' });
                        }
                    } else {
                        await socket.sendMessage(chatId, { text: '🚫 Link detectado, mas não posso banir (não sou admin)!' });
                    }
                    continue;
                }

                // Antiporno
                if (groupConfig.antiporno && isPornographic(msg.message)) {
                    console.log(`Conteúdo pornográfico detectado em ${chatId} por ${sender}`);
                    await socket.sendMessage(chatId, { delete: msg.key });
                    if (isBotGroupAdmin) {
                        if (isSenderAdmin) {
                            await socket.sendMessage(chatId, { text: '🚫 Conteúdo pornográfico detectado! Como você é admin, não será banido.' });
                        } else {
                            await socket.groupParticipantsUpdate(chatId, [sender], 'remove');
                            await socket.sendMessage(chatId, { text: '🚫 Conteúdo pornográfico detectado! Usuário banido!' });
                        }
                    } else {
                        await socket.sendMessage(chatId, { text: '🚫 Conteúdo pornográfico detectado, mas não posso banir (não sou admin)!' });
                    }
                    continue;
                }
            }
        }
    } catch (error) {
        console.error(`Erro ao processar evento de mensagem: ${error.message}`);
        const chatId = event?.messages?.[0]?.key?.remoteJid;
        if (chatId) {
            // await socket.sendMessage(chatId, { text: '❌ Erro ao processar evento. Tente novamente.' });
        }
    }
}

/**
 * Processa eventos de atualização de participantes (ex.: boas-vindas).
 * @param {Object} socket - Instância do socket do WhatsApp.
 * @param {Object} event - Evento de atualização de participantes.
 */
async function handleGroupParticipantsUpdate(socket, event) {
    try {
        const { id: chatId, participants, action } = event;
        if (!chatId || !chatId.endsWith('@g.us')) return;
        if (action !== 'add') return; // Apenas para adições

        const groupConfig = await getGroupConfig(chatId);
        console.log(`Evento de participante em ${chatId}:`, event);
        // console.log(`Configurações do grupo ${chatId}:`, groupConfig);

        if (groupConfig.welcome_enabled && groupConfig.welcome_message) {
            for (const participant of participants) {
                const welcomeMessage = groupConfig.welcome_message.replace('{user}', `@${participant.split('@')[0]}`);
                await socket.sendMessage(chatId, { text: welcomeMessage, mentions: [participant] });
                console.log(`Mensagem de boas-vindas enviada para ${participant} em ${chatId}`);
            }
        }
    } catch (error) {
        console.error(`Erro ao processar evento de participante: ${error.message}`);
        const chatId = event?.id;
        if (chatId) {
            // await socket.sendMessage(chatId, { text: '❌ Erro ao processar evento de participante. Tente novamente.' });
        }
    }
}

/**
 * Ativa ou desativa o sistema antilink em um grupo.
 * @param {string} chatId - ID do grupo.
 * @param {boolean} enable - Ativar (true) ou desativar (false).
 */
async function toggleAntilink(chatId, enable) {
    const groupConfig = await getGroupConfig(chatId);
    if (!groupConfig?.id) throw new Error('Configuração do grupo não encontrada');
    await updateGroupConfig(chatId, { ...groupConfig, antilink: enable });
}

/**
 * Ativa ou desativa o sistema antilinkhard em um grupo.
 * @param {string} chatId - ID do grupo.
 * @param {boolean} enable - Ativar (true) ou desativar (false).
 */
async function toggleAntilinkHard(chatId, enable) {
    const groupConfig = await getGroupConfig(chatId);
    if (!groupConfig?.id) throw new Error('Configuração do grupo não encontrada');
    await updateGroupConfig(chatId, { ...groupConfig, antilinkhard: enable });
}

/**
 * Ativa ou desativa o sistema antiporno em um grupo.
 * @param {string} chatId - ID do grupo.
 * @param {boolean} enable - Ativar (true) ou desativar (false).
 */
async function toggleAntiporno(chatId, enable) {
    const groupConfig = await getGroupConfig(chatId);
    if (!groupConfig?.id) throw new Error('Configuração do grupo não encontrada');
    await updateGroupConfig(chatId, { ...groupConfig, antiporno: enable });
}

module.exports = {
    handleGroupEvents,
    handleGroupParticipantsUpdate,
    toggleAntilink,
    toggleAntilinkHard,
    toggleAntiporno,
};