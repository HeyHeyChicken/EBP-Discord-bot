// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const ContentManager = require("./ContentManager");
const PATH = require("path");
const { EmbedBuilder } = require("discord.js");

//#endregion

/**
 * Specialized manager for After-H game maps.
 */
class HeroManager extends ContentManager {
  constructor(discord, database, screenshotService, domain) {
    super(discord, database, screenshotService, domain, "heroes");
  }

  /**
   * Prepare the screenshot URLs for the items.
   * @param {Array} items - List of elements (weapons, heroes, modes, maps, etc.)
   * @param {Object} itemsUrls - Base URLs by language.
   * @returns {Array} List of screenshot URLs to generate.
   */
  prepareUrls(items, itemsUrls) {
    const SCREENSHOT_URLS = [];

    for (const LANGUAGE of this._languages) {
      for (let item of items) {
        SCREENSHOT_URLS.push([
          PATH.join(
            this.screenshotsFolder,
            this.formatNameForFile(LANGUAGE, item.name)
          ),
          itemsUrls[LANGUAGE] +
            "/" +
            this.formatNameForUrl(item.name) +
            "?discord=1",
        ]);
      }
    }

    return SCREENSHOT_URLS;
  }

  /**
   * Abstract method - Formatting the name for the URL.
   * @param {string} name - Item name.
   * @returns {string} Name formatted for the URL.
   */
  formatNameForUrl(name) {
    return name.toLowerCase().replaceAll(" ", "%20");
  }

  /**
   * Abstract method - File name formatting.
   * @param {string} language - Language.
   * @param {string} name - Item name.
   * @returns {string} Formatted filename.
   */
  formatNameForFile(language, name) {
    return (language + "_" + name).toUpperCase() + ".png";
  }

  /**
   * Retrieves data from the API.
   * @param {Function} callback - Callback function with data.
   */
  async fetchDataFromAPI(callback) {
    await this._database.fetchNewContent("heroes", callback);
  }

  /**
   * Generates a Discord embed for an item.
   * @param {Object} item - Item (weapon, hero, mode, maps, etc.)
   * @param {string} dateString - Formatted date.
   * @param {string} imageURL - Image URL.
   * @param {string} itemURL - URL of the element.
   * @returns {Object} Embed Discord.
   */
  createEmbed(weapon, dateString, imageURL, weaponURL) {
    return new EmbedBuilder()
      .setTitle(weapon.name.toUpperCase())
      .setURL(weaponURL)
      .setImage(imageURL)
      .setFooter({
        text: dateString,
      })
      .setColor("#313338");
  }

  /**
   * Returns the channel tag for this type of content.
   * @returns {string} Channel tag.
   */
  getChannelTag() {
    return "#EBP_HEROES_BOT(";
  }

  /**
   * Refreshes the content on a Discord server.
   * @param {Object} server - Discord Server.
   * @param {Array} items - List of elements.
   * @param {Object} baseUrls - Base URLs by language.
   * @param {Function} i18nFunction - Translation function.
   */
  async refreshServer(server, items, baseUrls, i18nFunction) {
    console.log(`        Server: "${server.name}"`);

    // Retrieve the channels that contain the weapon tags.
    const WEAPONS_CHANNELS = this._discord
      ._getServerChannels(server)
      .filter(
        (channel) =>
          channel.topic && channel.topic.includes(this.getChannelTag())
      );

    if (WEAPONS_CHANNELS.length === 0) {
      console.error(`No weapon channel found in the "${server.name}" server.`);
      return;
    }

    for (const CHANNEL of WEAPONS_CHANNELS) {
      this.refreshChannel(CHANNEL, items, baseUrls, i18nFunction);
    }

    console.log("Weapons refresh finished!");
  }

  /**
   * Refreshes the content on a Discord channel
   * @param {Object} channel - Discord channel.
   * @param {Array} items - List of items.
   * @param {Object} baseUrls - Base URLs by language.
   * @param {Function} i18nFunction - Translation function.
   */
  async refreshChannel(channel, items, baseUrls, i18nFunction) {
    if (channel.topic.includes(this.getChannelTag())) {
      const LANGUAGE = channel.topic
        .split(this.getChannelTag())
        .at(-1)
        .slice(0, 2)
        .toLowerCase();

      console.log(`            Channel: "${channel.name}"`);
      let OLD_MESSAGES = await this._discord.getOldMessages(channel);

      // Filter old bot messages.
      const OLD_BOT_MESSAGES = OLD_MESSAGES.filter(
        (x) =>
          x.author.bot &&
          x.author.username === this._discord.client.user.username &&
          x.author.discriminator === this._discord.client.user.discriminator
      );

      let nbMessageSend = 0;

      for (const ITEM of items) {
        const DATE = new Date(ITEM.date);
        const DATE_STRING = this._formatDate(DATE);
        let allowAddNewWeapon = true;

        const OLD_BOT_MESSAGE = OLD_BOT_MESSAGES.find(
          (message) =>
            message.embeds[0] &&
            message.embeds[0].title === ITEM.name.toUpperCase()
        );

        const IMAGE = await this._database.selectImage(
          ITEM.name,
          LANGUAGE,
          "heroes"
        );

        if (IMAGE) {
          if (OLD_BOT_MESSAGE) {
            allowAddNewWeapon = false;
            if (OLD_BOT_MESSAGE.embeds[0]) {
              const OLD_DATE_STRING = OLD_BOT_MESSAGE.embeds[0].footer.text;

              if (DATE_STRING !== OLD_DATE_STRING) {
                try {
                  await OLD_BOT_MESSAGE.edit({
                    embeds: [
                      this.createEmbed(
                        ITEM,
                        DATE_STRING,
                        IMAGE.url,
                        `${this._domain}/${LANGUAGE}`
                      ),
                    ],
                  });
                } catch (e) {
                  console.error(
                    `        Unable to modify the message (Server: "${channel.guild.name}", channel: "${channel.name}").`,
                    e
                  );
                }
              }
            }
          }

          if (allowAddNewWeapon) {
            if (
              await this._discord.sendMessage(
                channel,
                "",
                this.createEmbed(
                  ITEM,
                  DATE_STRING,
                  IMAGE.url,
                  `${this._domain}/${LANGUAGE}`
                )
              )
            ) {
              nbMessageSend++;
            }
          }
        } else {
          console.error(
            `Can't find image (Mode: "${ITEM.name}", language: "${LANGUAGE}").`
          );
        }
      }

      // Final message.
      const OLD_FINAL = OLD_BOT_MESSAGES.filter((x) =>
        x.content.startsWith("─────────────")
      );

      if (nbMessageSend > 0 || OLD_FINAL.length === 0) {
        OLD_FINAL.forEach((message) => {
          try {
            message.delete();
          } catch (e) {
            console.error(
              `        Unable to delete the message (Server: "${channel.guild.name}", channel: "${channel.name}").`,
              e
            );
          }
        });

        try {
          await channel.send({
            content:
              "───────────────────────────────────\n" +
              i18nFunction("source", LANGUAGE) +
              ": " +
              `<${this._domain}/${LANGUAGE}>` +
              "\n" +
              i18nFunction("install", LANGUAGE) +
              ": " +
              `<https://github.com/HeyHeyChicken/EBP-Discord-bot>`,
          });
        } catch (e) {
          console.error(
            `        Unable to send a message (Server: "${channel.guild.name}", channel: "${channel.name}").`,
            e
          );
        }
      }
    }
  }

  /**
   * Format a date in DD/MM/YYYY HH:MM format.
   * @param {Date} date - Date to format.
   * @returns {string} Formatted date.
   */
  _formatDate(date) {
    return (
      ("0" + date.getDate()).slice(-2) +
      "/" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "/" +
      date.getFullYear() +
      " " +
      ("0" + date.getHours()).slice(-2) +
      ":" +
      ("0" + date.getMinutes()).slice(-2)
    );
  }
}

module.exports = HeroManager;
