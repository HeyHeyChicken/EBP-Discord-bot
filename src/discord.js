//#region Imports

const { Client, GatewayIntentBits } = require("discord.js"); // Cette librairie me permet de communiquer avec l'API de Discord.

//#endregion

/**
 * Cette classe a pour but de télécharger les screenshots des armes dans toutes les langues.
 */
class Discord {
  constructor(devMode) {
    this.ebpServerId = 1113942572818255992; /* ID du serveur d'EBP */
    this.ebpDevChannelId = 1296730928588132394; /* ID du salon dédié à l'upload des images */

    this._devMode = devMode;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  //#region GETTERS

  /**
   * Cette fonction retourne la liste des serveurs qui utilisent le bot.
   * @returns Liste de serveurs qui utilisent le bot.
   */
  _getServers() {
    return Array.from(this.client.guilds.cache).map((server) => server[1]);
  }

  /**
   * Cette fonction retourne la liste des salons d'un serveur.
   * @param {*} server Serveur à analyser.
   * @returns Liste des salons d'un serveur.
   */
  _getServerChannels(server) {
    return Array.from(server.channels.cache).map((channel) => channel[1]);
  }

  /**
   * Cette fonction retourne le serveur à qui appartien le salon.
   * @param {*} channel Salon.
   * @returns Serveur à qui appartien le salon.
   */
  _getChannelServer(channel) {
    return this._getServers().find((server) => server.id == channel.guild.id);
  }

  /**
   * Cette fonction retourne les anciens messages d'un salon.
   * @param {*} channel Salon à analyser.
   * @param {*} limit Nombre de messages maximim à récupérer.
   * @returns Liste de messages du salon.
   */
  async getOldMessages(channel, limit = 100) {
    console.log(`                Trying to get old messages...`);
    let allMessages = [];

    try {
      let lastMessageId = null;
      let remaining = limit;

      while (remaining > 0) {
        const FETCH_LIMIT = Math.min(remaining, 100); // Max 100 par requête
        const OPTIONS = { limit: FETCH_LIMIT };

        if (lastMessageId) {
          OPTIONS.before = lastMessageId;
        }

        const MESSAGES = await channel.messages.fetch(OPTIONS);

        if (MESSAGES.size === 0) {
          break; // Plus de messages disponibles
        }

        const MESSAGES_ARRAY = Array.from(MESSAGES.values());
        allMessages.push(...MESSAGES_ARRAY);

        lastMessageId = MESSAGES_ARRAY[MESSAGES_ARRAY.length - 1].id;
        remaining -= MESSAGES.size;
      }
    } catch (e) {
      console.error(
        `        Unable to access messages (Channel: "${channel.name}").`,
        e
      );
    }

    console.log(`                Got old messages (${allMessages.length})`);
    return allMessages;
  }

  //#endregion

  //#region SEND MESSAGES

  dateFormat(date) {
    const DATE = new Date(date);
    return (
      ("0" + DATE.getDate()).slice(-2) +
      "/" +
      ("0" + (DATE.getMonth() + 1)).slice(-2) +
      "/" +
      DATE.getFullYear() +
      " " +
      ("0" + DATE.getHours()).slice(-2) +
      ":" +
      ("0" + DATE.getMinutes()).slice(-2)
    );
  }

  async _sendImageToTmpServer(channel, weaponName, weaponDate, imagePath) {
    const DATE_STRING = this.dateFormat(weaponDate);
    const MESSAGE = weaponName + "\n" + DATE_STRING;
    const NEW_MESSAGE = await this.sendMessage(
      channel,
      MESSAGE,
      undefined,
      imagePath
    );
    if (NEW_MESSAGE) {
      return NEW_MESSAGE.attachments.first().proxyURL;
    }
    return undefined;
  }

  /**
   * Cette fonction permet d'envoyer un message dans un salon.
   * @param {*} channel Salon où envoyer le message.
   * @param {*} content Contenu du message à envoyer dans le salon.
   * @param {*} embed Embed lié au message à envoyer dans le salon.
   * @param {*} file Fichier lié au message à envoyer dans le salon.
   * @param {*} callback (optionnel) Fonction de retour, indiquant ou non un succès.
   */
  async sendMessage(channel, content, embed, file) {
    let message = undefined;
    try {
      message = await channel.send({
        content: content,
        embeds: embed ? [embed] : undefined,
        files: file ? [file] : file,
      });
    } catch (e) {
      console.error(
        `        Impossible d'envoyer un message (Server: "${
          this._getChannelServer(channel).name
        }", channel: "${channel.name}").`,
        e,
        content,
        embed,
        file
      );
    }
    return message;
  }

  //#endregion

  async deleteMessage(message, callback) {
    try {
      await message.delete();
      if (callback) {
        callback(true);
      }
    } catch (e) {
      const SERVER = this._getServers().find((x) => x.id == message.guildId);
      const CHANNEL = this._getServerChannels(SERVER).find(
        (x) => x.id == message.channelId
      );
      console.error(
        `        Impossible de supprimer le messages (Server: "${SERVER.name}", channel: "${CHANNEL.name}").`,
        e
      );
      if (callback) {
        callback(false);
      }
    }
  }

  async deleteWeaponMessage(oldMessages, weaponName, weaponDate) {
    const A_WEAPON_OLD_MESSAGES = oldMessages.filter((message) =>
      message.content.startsWith(weaponName + "\n")
    );
    const FORMATED_DATE = this.dateFormat(weaponDate);
    if (A_WEAPON_OLD_MESSAGES.length == 0) {
      return true;
    }
    const A_WEAPON_OLD_MESSAGE = A_WEAPON_OLD_MESSAGES.find((message) =>
      message.content.endsWith("\n" + FORMATED_DATE)
    );
    let canCreate = !A_WEAPON_OLD_MESSAGE || A_WEAPON_OLD_MESSAGE.length == 0;
    for (let message of A_WEAPON_OLD_MESSAGES) {
      if (!message.content.endsWith("\n" + FORMATED_DATE)) {
        await this.deleteMessage(message);
      }
    }
    return canCreate;
  }

  /**
   * Cette fonction permet d'attentre.
   * @param {*} time Temps en millisecondes.
   * @returns
   */
  async _delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
}

module.exports = Discord;
