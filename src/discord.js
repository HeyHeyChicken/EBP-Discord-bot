// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js"); // This library allows communication with the Discord API.

//#endregion

/**
 * This class aims to upload screenshots of weapons in all languages.
 */
class Discord {
  constructor(devMode) {
    this.ebpServerId = 1113942572818255992; /* EBP server ID */
    this.ebpDevChannelId = 1296730928588132394; /* ID of the chat room dedicated to uploading images. */

    this._devMode = devMode;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });
  }

  //#region GETTERS

  /**
   * This function returns the list of servers that use the bot.
   * @returns List of servers that use the bot.
   */
  _getServers() {
    return Array.from(this.client.guilds.cache).map((server) => server[1]);
  }

  /**
   * This function returns the list of rooms on a server.
   * @param {*} server Server to analyze.
   * @returns List of rooms on a server.
   */
  _getServerChannels(server) {
    return Array.from(server.channels.cache).map((channel) => channel[1]);
  }

  /**
   * This function returns the server to which the room belongs.
   * @param {*} channel Channel.
   * @returns Server who owns the chat room.
   */
  _getChannelServer(channel) {
    return this._getServers().find((server) => server.id == channel.guild.id);
  }

  /**
   * This function returns the old messages from a chat room.
   * @param {*} channel Trade show to analyze.
   * @param {*} limit Maximum number of messages to retrieve.
   * @returns List of messages from the chat room.
   */
  async getOldMessages(channel, limit = 100) {
    console.log(`                Trying to get old messages...`);

    // Check if bot has permission to read message history
    if (!channel.permissionsFor(this.client.user).has(PermissionFlagsBits.ReadMessageHistory)) {
      console.error(`Bot lacks ReadMessageHistory permission in channel: ${channel.name}`);
      return [];
    }

    let allMessages = [];

    try {
      let lastMessageId = null;
      let remaining = limit;

      while (remaining > 0) {
        const FETCH_LIMIT = Math.min(remaining, 100); // Maximum 100 per request.
        const OPTIONS = { limit: FETCH_LIMIT };

        if (lastMessageId) {
          OPTIONS.before = lastMessageId;
        }

        const MESSAGES = await channel.messages.fetch(OPTIONS);

        if (MESSAGES.size === 0) {
          break; // More messages available.
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

  /**
   * Delete a Discord message.
   * @param {Object} message - The Discord message object to delete.
   * @param {Function} [callback] - Optional callback function to execute with success/failure status.
   */
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
        `        Unable to delete the message (Server: "${SERVER.name}", channel: "${CHANNEL.name}").`,
        e
      );
      if (callback) {
        callback(false);
      }
    }
  }

  /**
   * Delete old weapon messages that don't match the current date.
   * @param {Array} oldMessages - Array of old Discord messages to filter through.
   * @param {string} weaponName - The name of the weapon.
   * @param {string} weaponDate - The date of the weapon.
   * @returns {Promise<boolean>} Returns true if a new message can be created, false otherwise.
   */
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
   * Create a new Discord channel in a server.
   * @param {Object} server - The Discord server object.
   * @param {string} name - The name of the channel to create.
   * @param {string} topic - The topic/description of the channel.
   * @param {Function} [callback] - Optional callback function to execute with the created channel.
   */
  async createChannel(server, name, topic, callback) {
    try {
      const SERVER = await server.channels.create({
        name: name,
        topic: topic,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: this.client.user.id, // Bot permissions
            allow: [PermissionFlagsBits.SendMessages],
          },
          {
            id: server.roles.everyone.id, // @everyone
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              PermissionFlagsBits.SendMessagesInThreads,
            ],
          },
        ],
      });
      if (callback) {
        callback(SERVER);
      }
    } catch (e) {
      console.error(
        `        Unable to create the room on the server "${server.name}".`,
        e
      );
    }
  }

  /**
   * This function allows for waiting.
   * @param {*} time Time in milliseconds.
   */
  async _delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
}

module.exports = Discord;
