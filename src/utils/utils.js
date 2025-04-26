const axios = require('axios');
const cfonts = require('cfonts');
const Crypto = require('crypto');
const chalk = require('chalk');
const { exec } = require('child_process');
const mimetype = require('mime-types');
const { fromBuffer } = require('file-type');
const FormData = require('form-data');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment-timezone');
const path = require('path'); 


const colors = {
  corzinhas: ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright'],
  getRandomColor: () => colors.corzinhas[Math.floor(Math.random() * colors.corzinhas.length)],
};


try {
  ffmpeg.setFfmpegPath('ffmpeg'); 
} catch (error) {
  console.error('Erro ao configurar ffmpeg:', error.message);

}


const loadCeemde = async () => {
  try {
    return JSON.parse(await fs.readFile('./bunker/database/data/totalcmd.json', 'utf8'));
  } catch (error) {
    console.error('Erro ao carregar totalcmd.json:', error.message);
    return {};
  }
};


const getPrivateChats = async (totalchat) => {
  if (!Array.isArray(totalchat)) return [];
  return totalchat
    .map(chat => chat.id)
    .filter(id => id && !id.includes('g.us'));
};

const upload = async (media) => {
  try {
    const { ext } = await fromBuffer(media);
    const form = new FormData();
    form.append('file', media, `tmp.${ext}`);
    const response = await axios.post('https://telegra.ph/upload', form, {
      headers: form.getHeaders(),
    });
    return `https://telegra.ph${response.data[0].src}`;
  } catch (error) {
    throw new Error(`Erro ao fazer upload: ${error.message}`);
  }
};

const convertSticker = async (base64, author, pack) => {
  try {
    const response = await axios.post('https://sticker-api-tpe3wet7da-uc.a.run.app/prepareWebp', {
      image: base64,
      stickerMetadata: { author, pack, keepScale: true, removebg: 'HQ' },
      sessionInfo: {
        WA_VERSION: '2.2106.5',
        PAGE_UA: 'WhatsApp/2.2037.6 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
        WA_AUTOMATE_VERSION: '3.6.10 UPDATE AVAILABLE: 3.6.11',
        BROWSER_VERSION: 'HeadlessChrome/88.0.4324.190',
        OS: 'Windows Server 2016',
        START_TS: 1614310326309,
        NUM: '6247',
        LAUNCH_TIME_MS: 7934,
        PHONE_VERSION: '2.20.205.16',
      },
      config: {
        sessionId: 'session',
        headless: true,
        qrTimeout: 20,
        authTimeout: 0,
        cacheEnabled: false,
        useChrome: true,
        killProcessOnBrowserClose: true,
        throwErrorOnTosBlock: false,
        chromiumArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--aggressive-cacheTosBlock: false'],
        stickerServerEndpoint: true,
      },
    }, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'User-Agent': 'axios/0.21.1',
      },
    });
    return response.data.webpBase64;
  } catch (error) {
    throw new Error(`Erro ao converter sticker: ${error.message}`);
  }
};

const fetchJson = async (url, options = {}) => {
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao buscar JSON: ${error.message}`);
  }
};

const fetchText = async (url, options = {}) => {
  try {
    const response = await axios.get(url, { ...options, responseType: 'text' });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao buscar texto: ${error.message}`);
  }
};

const createExif = async (pack, auth) => {
  const code = [0x00, 0x00, 0x16, 0x00, 0x00, 0x00];
  const exif = {
    'sticker-pack-id': 'com.client.tech',
    'sticker-pack-name': pack,
    'sticker-pack-publisher': auth,
    'android-app-store-link': 'https://play.google.com/store/apps/details?id=com.termux',
    'ios-app-store-link': 'https://itunes.apple.com/app/sticker-maker-studio/id1443326857',
  };
  let len = JSON.stringify(exif).length;
  code.unshift(len > 256 ? 0x01 : 0x00);
  len = len.toString(16).padStart(2, '0');
  const buffer = Buffer.concat([
    Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]),
    Buffer.from(len, 'hex'),
    Buffer.from(code),
    Buffer.from(JSON.stringify(exif)),
  ]);
  const fileDir = path.join(__dirname, 'sticker');
  const filePath = path.join(fileDir, 'data.exif');
  try {
    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error('Erro ao criar EXIF:', error.message);
    throw error;
  }
};


const getBuffer = async (url, options = {}) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36',
        DNT: 1,
        'Upgrade-Insecure-Requests': 1,
      },
      responseType: 'arraybuffer',
      ...options,
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Erro ao buscar buffer: ${error.message}`);
    throw error;
  }
};

const randomBytes = (length) => Crypto.randomBytes(length);

const generateMessageID = () => randomBytes(10).toString('hex').toUpperCase();

const getExtension = async (type) => mimetype.extension(type) || 'bin';

const getGroupAdmins = (participants) => {
  if (!Array.isArray(participants)) return [];
  return participants
    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
    .map(p => p.id);
};

const getGroupMembers = (participants) => {
  if (!Array.isArray(participants)) return [];
  return participants
    .filter(p => p.admin === null)
    .map(p => p.id);
};

const getRandom = (ext) => `${Math.floor(Math.random() * 10000)}${ext}`;


const temporizador = (seconds) => {
  const pad = (s) => (s < 10 ? '0' : '') + s;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const color = (text, color) => (color ? chalk.keyword(color)(text) : chalk.green(text));

const bgcolor = (text, bgcolor) => (bgcolor ? chalk.bgKeyword(bgcolor)(text) : chalk.green(text));

const recognize = (filename, config = {}) => {
  const options = Object.entries(config)
    .filter(([key]) => !['debug', 'presets', 'binary'].includes(key))
    .map(([key, value]) => (key === 'lang' ? `-l ${value}` : ocrOptions.includes(key) ? `--${key} ${value}` : `-c ${key}=${value}`))
    .concat(config.presets || [])
    .filter(Boolean);
  const binary = config.binary || 'tesseract';
  const command = [binary, `"${filename}"`, 'stdout', ...options].join(' ');
  if (config.debug) console.debug('OCR command:', command);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (config.debug) console.debug('OCR stderr:', stderr);
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const ocrOptions = ['tessdata-dir', 'user-words', 'user-patterns', 'psm', 'oem', 'dpi'];

const authorname = 'Anna V6 Ultra';
const packname = 'Criador: GleysonDevs Oficial';
const ownerNumber = '5511911942403@s.whatsapp.net';


const usedCommandRecently = new Set();

const isFiltered = (from) => usedCommandRecently.has(from);

const addFilter = (from) => {
  usedCommandRecently.add(from);
  setTimeout(() => usedCommandRecently.delete(from), 5000);
};

const banner2 = cfonts.render('ANNA V7 ULTRA by GleysonDevs', {
  font: 'console',
  align: 'center',
  colors: colors.getRandomColor(),
});

const banner3 = cfonts.render('ANNA V7', {
  font: 'block',
  align: 'center',
  colors: ['whiteBright'],
  background: 'transparent',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0',
  gradient: ['whiteBright'],
  independentGradient: false,
  transitionGradient: false,
  env: 'node',
});

const exportsList = {
  getBuffer,
  fetchJson,
  fetchText,
  generateMessageID,
  getGroupAdmins,
  getGroupMembers,
  getRandom,
  banner2,
  temporizador,
  color,
  recognize,
  bgcolor,
  isFiltered,
  addFilter,
  banner3,
  getExtension,
  convertSticker,
  upload,
  getPrivateChats,
  authorname,
  packname,
  ownerNumber,
  createExif,
};

module.exports = exportsList;