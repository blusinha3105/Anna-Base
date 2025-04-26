const fs = require('fs').promises;
const path = require('path');

// Caminho para o arquivo JSON
const jsonPath = path.resolve(__dirname, '../../database/groups.json');

/**
 * Inicializa o arquivo JSON se não existir.
 * @returns {Promise<void>}
 */
async function initDatabase() {
    try {
        // Verifica se o diretório existe, caso contrário, cria
        const dir = path.dirname(jsonPath);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
            console.log('Diretório database criado:', dir);
        }

        // Verifica se o arquivo JSON existe, caso contrário, cria um vazio
        try {
            await fs.access(jsonPath);
            console.log('Arquivo groups.json já existe.');
        } catch {
            await fs.writeFile(jsonPath, JSON.stringify({}, null, 2));
            console.log('Arquivo groups.json criado com sucesso.');
        }
    } catch (error) {
        console.error('Falha ao inicializar o arquivo JSON:', error.message);
        throw error;
    }
}

/**
 * Obtém as configurações de um grupo específico, inicializando se necessário.
 * @param {string} groupId - ID do grupo.
 * @returns {Promise<Object>} Configurações do grupo.
 */
async function getGroupConfig(groupId) {
    try {
        // Lê o arquivo JSON
        const data = await fs.readFile(jsonPath, 'utf8');
        const groups = data ? JSON.parse(data) : {};

        // Define valores padrão
        const defaultConfig = {
            id: groupId,
            prefix: '!',
            antifake: false,
            welcome_enabled: false,
            welcome_message: '',
            blacklist: [],
            antilink: false,
            antilinkhard: false,
            antiporno: false,
        };

        // Verifica se o grupo existe no JSON
        if (!groups[groupId]) {
            console.log(`Grupo ${groupId} não encontrado. Criando configuração padrão.`);
            groups[groupId] = defaultConfig;
            // Salva o novo grupo no JSON
            await fs.writeFile(jsonPath, JSON.stringify(groups, null, 2));
            return defaultConfig;
        }

        // Retorna a configuração do grupo, garantindo que todos os campos existam
        const config = {
            id: groupId,
            prefix: groups[groupId].prefix || '!',
            antifake: !!groups[groupId].antifake,
            welcome_enabled: !!groups[groupId].welcome_enabled,
            welcome_message: groups[groupId].welcome_message || '',
            blacklist: Array.isArray(groups[groupId].blacklist) ? groups[groupId].blacklist : [],
            antilink: !!groups[groupId].antilink,
            antilinkhard: !!groups[groupId].antilinkhard,
            antiporno: !!groups[groupId].antiporno,
        };

       // console.log(`Configuração carregada para grupo ${groupId}:`, config);
        return config;
    } catch (error) {
        console.error(`Erro crítico ao obter configuração do grupo ${groupId}: ${error.message}`);
        throw error;
    }
}

/**
 * Atualiza as configurações de um grupo específico.
 * @param {string} groupId - ID do grupo.
 * @param {Object} config - Configurações atualizadas do grupo.
 * @returns {Promise<void>}
 */
async function updateGroupConfig(groupId, config) {
    try {
        // Lê o arquivo JSON
        const data = await fs.readFile(jsonPath, 'utf8');
        const groups = data ? JSON.parse(data) : {};

        // Normaliza os valores antes de salvar
        const normalizedConfig = {
            id: groupId,
            prefix: config.prefix || '!',
            antifake: !!config.antifake,
            welcome_enabled: !!config.welcome_enabled,
            welcome_message: config.welcome_message || '',
            blacklist: Array.isArray(config.blacklist) ? config.blacklist : [],
            antilink: !!config.antilink,
            antilinkhard: !!config.antilinkhard,
            antiporno: !!config.antiporno,
        };

        // Atualiza o grupo no objeto
        groups[groupId] = normalizedConfig;

        // Salva o objeto atualizado no arquivo JSON
        await fs.writeFile(jsonPath, JSON.stringify(groups, null, 2));
        console.log(`Configuração atualizada para grupo ${groupId}:`, normalizedConfig);
    } catch (error) {
        console.error(`Erro crítico ao atualizar configuração do grupo ${groupId}: ${error.message}`);
        throw error;
    }
}

// Inicializa o arquivo JSON ao carregar o módulo
initDatabase().catch((error) => {
    console.error('Erro ao iniciar o arquivo JSON:', error.message);
    process.exit(1); // Encerra o processo em caso de falha crítica
});

module.exports = { initDatabase, getGroupConfig, updateGroupConfig };