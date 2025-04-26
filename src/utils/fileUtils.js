
const fs = require('fs').promises;

async function deleteFileAsync(file) {
  try {
    await fs.unlink(file);
  } catch (error) {
    console.warn(`Falha ao deletar arquivo ${file}: ${error.message}`);
  }
}

module.exports = { deleteFileAsync };