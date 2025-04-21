
# 🤖 Anna-Base Bot

Bem-vindo ao **Anna-Base Bot**! Este README interativo irá guiá-lo para configurar e usar o bot de forma simples e divertida. 🌟

---

## 🚀 Como Começar

1. **Clone o Repositório**  
    ```bash
    git clone https://github.com/blusinha3105/Anna-Base.git
    cd anna-base-bot
    ```

2. **Instale as Dependências**  
    ```bash
    npm install
    ```

3. **Configure o Bot**  
    Siga até `./src/config/settings.js` e edite as seguintes variáveis:
    ```env
     settings: {
      prefix: '!',
      ownerNumber: '5511999999999@s.whatsapp.net',
      botName: 'Bot 2025',
    },
    api: {
      url: 'https://zero-two.online',
      url2: 'https://api.nexfuture.com.br',
      key: 'SUa Apikey',
    },
    images: {
      MenuImg: 'https://img1.pixhost.to/images/5184/590318262_menulist-image2.jpg',
      welcomeBg: 'https://img1.pixhost.to/images/5183/590307255_image.jpg',
      goodbyeBg: 'https://example.com/goodbye-bg.jpg',
    },
    ```

4. **Inicie o Bot**  
    ```bash
    npm start
    ```

---

## ✨ Funcionalidades

- **Respostas Inteligentes**: O bot responde a comandos pré-definidos.
- **Personalização**: Configure o prefixo e comandos facilmente.
- **Integração**: Conecte-se a APIs externas para funcionalidades avançadas.

---

## 🛠️ Comandos Básicos

| Comando            | Descrição                                      |
|--------------------|------------------------------------------------|
| `!ping`            | Verifica se o bot está online.                 |
| `!menu`            | Mostra a lista de todos os comandos.           |
| `!antifake [on/off]` | Ativa ou desativa o sistema antifake.        |
| `!antilink [on/off]` | Ativa ou desativa o sistema antilink.        |
| `!antilinkhard [on/off]` | Ativa ou desativa o sistema antilinkhard.  |
| `!antiporno [on/off]` | Ativa ou desativa o sistema antiporno.       |
| `!ban @user`       | Bane um usuário do grupo.                      |
| `!setup`           | Configura a mensagem de boas-vindas do grupo.  |
| `!status`          | Verifica o status do bot no grupo.             |
| `!play [termo]`    | Pesquisa e envia áudio do YouTube.             |
| `!ytmp3 [url]`     | Baixa áudio de um vídeo do YouTube.            |
| `!play_video [termo]` | Pesquisa e envia vídeo do YouTube.          |
| `!ytmp4 [url]`     | Baixa vídeo de um vídeo do YouTube.            |
| `!tiktok [url]`    | Baixa vídeo do TikTok.                         |
| `!tiktokmp3 [url]` | Baixa áudio de um vídeo do TikTok.             |

---

## 🌈 Efeitos e Animações

Adicione um toque especial ao seu bot com animações! Use bibliotecas como [chalk](https://www.npmjs.com/package/chalk) para colorir o terminal ou [ora](https://www.npmjs.com/package/ora) para animações de carregamento.

Exemplo:
```javascript
const chalk = require('chalk');
const ora = require('ora');

const spinner = ora('Iniciando o bot...').start();

setTimeout(() => {
  spinner.succeed(chalk.green('Bot iniciado com sucesso!'));
}, 3000);
```

---

## 📜 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

💡 **Dica**: Para suporte ou dúvidas, entre em contato conosco no [Discord](https://discord.com).

Divirta-se usando o **Anna-Base Bot**! 🎉
## Powered by GleysonDevs Oficial
