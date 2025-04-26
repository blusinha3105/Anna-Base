
const axios = require('axios');
const { settings } = require('../config/settings');

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
};

function extractDDD(number) {
  return number.slice(0, 2);
}

function formatWelcomeText(template, groupMetadata, participant, socket) {
  return template
    .replace('#hora#', new Date().toLocaleTimeString())
    .replace('#nomedogp#', groupMetadata.subject)
    .replace('#numerodele#', participant.split('@')[0])
    .replace('#numerobot#', socket.user.id)
    .replace('#prefixo#', settings.prefix)
    .replace('#descrição#', groupMetadata.desc || '');
}

async function getBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

const getGroupAdmins = (participants) => {
  admins = []
  for (let i of participants) {
  if(i.admin == 'admin') admins.push(i.id)
  if(i.admin == 'superadmin') admins.push(i.id)
  }
  return admins
  }
  
  const getMembros = (participants) => {
  admins = []
  for (let i of participants) {
  if(i.admin == null) admins.push(i.id)
  }
  return admins
  }

module.exports = { colors, extractDDD, formatWelcomeText, getBuffer };