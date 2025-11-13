//#region Imports

const AXIOS = require("axios"); // This library allows me to query the REST API of EBP - EVA Battle Plan.
const PATH = require("path"); // This library allows me to create OS-related access paths.
const HTTP = require("http");
const FS = require("fs");
const { EmbedBuilder } = require("discord.js"); // This library allows me to communicate with the Discord API.

const Screenshoter = require("./screenshoter");
const Settings = require("./settings");
const Database = require("./database");
const Discord = require("./discord");

//#endregion

//#region Variables

const DEV_MODE = process.argv.slice(2)[0] == "true";
const API_URL = "https://evabattleplan.com/back/api-discord/?route="; // EBP REST API URL - EVA Battle Plan.

let weapons; // The list of weapons from the API will be stored here.
let weaponsUrls; // The list of URLs for the "Weapons" page will be stored here.
const LANGUAGES = ["en", "fr", "es", "de", "ro"]; // The bot will only work on channels that contain the element 0. The element 1 represents the guessed language of the channel.
const SETTINGS = new Settings();
const DISCORD = new Discord(DEV_MODE);
const DATABASE = new Database(API_URL);
const SCREENSHOTER = new Screenshoter(DISCORD, DATABASE);
const WEB_PORT = DEV_MODE ? 3001 : 3000;
const I18N = JSON.parse(
  FS.readFileSync(PATH.join(__dirname, "..", "i18n.json"), "utf8")
);
const HEYHEYCHICKEN_DISCORD_ID = "195958479394045952";

//#endregion

//#region Web server

/**
 * This web server tells the user if the bot is online.
 + URL : https://discord-weapons-bot.ebp.gg/
 */
const SERVER = HTTP.createServer((req, res) => {
  if (req.url === "/") {
    const SVG_PATH = PATH.join(__dirname, "assets/online.svg");

    FS.readFile(SVG_PATH, (err, data) => {
      // If there is a problem loading the image, text is displayed.
      if (err) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("EBP's Discord weapons bot is <b>online</b>.");
        return;
      }
      // An SVG is displayed indicating that the server is online.
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      });
      res.end(data);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

SERVER.listen(WEB_PORT, () => {
  console.log(`HTTP server listening on port "${WEB_PORT}".`);
});

//#endregion

function embedBuilder(weaponName, weaponDate, imageURL, weaponURL) {
  return new EmbedBuilder()
    .setTitle(weaponName.toUpperCase())
    .setURL(weaponURL)
    .setImage(imageURL)
    .setFooter({
      text: weaponDate,
    })
    .setColor("#313338");
}

/**
 * This function refreshes weapon information on a server.
 * @param {*} server Server needs refreshing.
 */
async function refresh(server) {
  console.log(`        Server: "${server.name}"`);
  // We retrieve the channels that want to contain the images.
  const WEAPONS_CHANNELS = DISCORD._getServerChannels(server).filter(
    (channel) => channel.topic && channel.topic.includes("#EBP_WEAPONS_BOT(")
  );

  if (WEAPONS_CHANNELS.length) {
    for (const CHANNEL of WEAPONS_CHANNELS) {
      const LANGUAGE = CHANNEL.topic
        .split("#EBP_WEAPONS_BOT(")
        .at(-1)
        .slice(0, 2)
        .toLowerCase();

      console.log(`            Channel: "${CHANNEL.name}"`);
      let OLD_MESSAGES = await DISCORD.getOldMessages(CHANNEL);

      // We filter out old messages to keep only those sent by the bot.
      const OLD_BOT_MESSAGES = OLD_MESSAGES.filter(
        (x) =>
          x.author.bot &&
          x.author.username == DISCORD.client.user.username &&
          x.author.discriminator == DISCORD.client.user.discriminator
      );
      let nbMessageSend = 0; // This variable represents the number of messages sent on the channel.

      for (const WEAPON of weapons) {
        const DATE = new Date(WEAPON.date);
        const DATE_STRING =
          ("0" + DATE.getDate()).slice(-2) +
          "/" +
          ("0" + (DATE.getMonth() + 1)).slice(-2) +
          "/" +
          DATE.getFullYear() +
          " " +
          ("0" + DATE.getHours()).slice(-2) +
          ":" +
          ("0" + DATE.getMinutes()).slice(-2);
        let allowAddNewWeapon = true;

        const OLD_BOT_MESSAGE = OLD_BOT_MESSAGES.find(
          (message) =>
            message.embeds[0] &&
            message.embeds[0].title == WEAPON.name.toUpperCase()
        ); // We are looking for an old message related to this weapon.

        const IMAGE = await DATABASE.selectImage(WEAPON.name, LANGUAGE);
        if (IMAGE) {
          if (OLD_BOT_MESSAGE) {
            allowAddNewWeapon = false;
            if (OLD_BOT_MESSAGE.embeds[0]) {
              const OLD_DATE_STRING = OLD_BOT_MESSAGE.embeds[0].footer.text;
              // We check that the weapon data is up to date on this channel.
              if (DATE_STRING != OLD_DATE_STRING) {
                try {
                  await await OLD_BOT_MESSAGE.edit({
                    embeds: [
                      embedBuilder(
                        WEAPON.name,
                        DATE_STRING,
                        IMAGE.url,
                        weaponsUrls[LANGUAGE] + "/" + encodeURI(WEAPON.name)
                      ),
                    ],
                  });
                } catch (e) {
                  console.error(
                    `        Unable to modify the message (Server: "${server.name}", channel: "${CHANNEL.name}").`,
                    e
                  );
                }
              }
            }
          }
          if (allowAddNewWeapon) {
            // We send a message containing the latest information about the weapon.

            if (
              await DISCORD.sendMessage(
                CHANNEL,
                "",
                embedBuilder(
                  WEAPON.name,
                  DATE_STRING,
                  IMAGE.url,
                  weaponsUrls[LANGUAGE] + "/" + encodeURI(WEAPON.name)
                )
              )
            ) {
              nbMessageSend++;
            }
          }
        } else {
          console.error(
            `Can't find image (Weapon: "${WEAPON.name}", language: "${LANGUAGE}").`
          );
        }
      }

      // The final message is sent.
      const OLD_FINAL = OLD_BOT_MESSAGES.filter((x) =>
        x.content.startsWith("─────────────")
      );
      if (nbMessageSend > 0 || OLD_FINAL.length == 0) {
        OLD_FINAL.forEach((message) => {
          try {
            message.delete();
          } catch (e) {
            console.error(
              `        Unable to delete the message (Server: "${server.name}", channel: "${CHANNEL.name}").`,
              e
            );
          }
        });
        try {
          await CHANNEL.send({
            content:
              "───────────────────────────────────\n" +
              i18n("source", LANGUAGE) +
              ": " +
              `<${weaponsUrls[LANGUAGE]}>` +
              "\n" +
              i18n("install", LANGUAGE) +
              ": " +
              `<https://github.com/HeyHeyChicken/EBP-Discord-weapons-bot>`,
          });
        } catch (e) {
          console.error(
            `        Unable to send a message (Server: "${server.name}", channel: "${CHANNEL.name}").`,
            e
          );
        }
      }
    }
    console.log("Refresh finnished!");
  } else {
    console.error(`No weapon channel found in the "${server.name}" server.`);
  }
}

function i18n(path, language) {
  if (!Object.keys(I18N).includes(language)) {
    language = "en";
  }
  return I18N[language][path];
}

function checkWeaponsDataFromAPI(callback) {
  console.log("Refreshing from API...");
  DATABASE.fetchNewWeapons(async (fetchedWeapons) => {
    weapons = fetchedWeapons;
    await SCREENSHOTER.download_screenshots(
      fetchedWeapons,
      SCREENSHOTER.prepare_urls(fetchedWeapons, weaponsUrls, LANGUAGES)
    ); // We're downloading the screenshots.

    console.log("Refreshed.");
    if (callback) {
      callback();
    }
  });
}

/**
 * Main function.
 */
async function loop() {
  console.log("Loop start...");
  checkWeaponsDataFromAPI(() => {
    // We're looping through the Discord servers using the bot.
    const SERVERS = DISCORD._getServers();
    console.log(`    There are "${SERVERS.length}" servers using this bot.`);
    for (const SERVER of SERVERS) {
      if (!DEV_MODE || (DEV_MODE && SERVER.name == "EBP - EVA Battle Plan")) {
        refresh(SERVER);
      }
    }
    console.log("Loop end.");
  });
}

// Listen to interactions (slash commands)
DISCORD.client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case "ebp_refresh":
      // Check administrator permissions
      if (!interaction.member.permissions.has("ADMINISTRATOR")) {
        await interaction.reply({
          content:
            "You must have administrator permissions to use this command.",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      const SERVER = DISCORD._getServers().find(
        (x) => x.id == interaction.guildId
      );

      if (SERVER) {
        console.log(
          `"${interaction.user.globalName}" asked for a manual refresh for the: "${SERVER.name}" server.`
        );

        await interaction.reply({
          content: "Refreshing...",
          flags: 64, // MessageFlags.Ephemeral
        });

        refresh(SERVER);
      } else {
        await interaction.reply({
          content: "Error: Server not found.",
          flags: 64, // MessageFlags.Ephemeral
        });
      }
      break;
    case "ebp_admin_list":
      // Verify that this is the bot administrator.
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      const SERVERS = DISCORD._getServers().map(
        (server) => server.name + " (" + server.id + ")"
      );

      const MAX_LENGTH = 1900; // Safety margin under 2000.
      const CHUNKS = [];
      let currentChunk = "";

      for (const SERVER of SERVERS) {
        const LINE_WITH_NEW_LINE = SERVER + "\n";
        if ((currentChunk + LINE_WITH_NEW_LINE).length > MAX_LENGTH) {
          if (currentChunk) {
            CHUNKS.push(currentChunk);
            currentChunk = LINE_WITH_NEW_LINE;
          } else {
            // If a single server exceeds the limit, it is truncated.
            CHUNKS.push(SERVER.substring(0, MAX_LENGTH - 3) + "...\n");
          }
        } else {
          currentChunk += LINE_WITH_NEW_LINE;
        }
      }
      if (currentChunk) {
        CHUNKS.push(currentChunk);
      }

      // First message with reply
      await interaction.reply({
        content: `Server List (${SERVERS.length}):\n\`\`\`${CHUNKS[0]}\`\`\``,
        flags: 64, // MessageFlags.Ephemeral
      });

      // Subsequent messages with follow-up
      for (let i = 1; i < CHUNKS.length; i++) {
        await interaction.followUp({
          content: `\`\`\`${CHUNKS[i]}\`\`\``,
          flags: 64, // MessageFlags.Ephemeral
        });
      }
      break;
    case "ebp_admin_refresh":
      // Verify that this is the bot administrator
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      const SERVER_ID = interaction.options.getString("server_id");

      checkWeaponsDataFromAPI(async () => {
        const SERVER = DISCORD._getServers().find(
          (server) => server.id == SERVER_ID
        );
        if (SERVER) {
          const CHANNELS = DISCORD._getServerChannels(SERVER).filter(
            (channel) =>
              channel.topic && channel.topic.includes("#EBP_WEAPONS_BOT(")
          );
          if (CHANNELS.length > 0) {
            console.log(
              `There are ${CHANNELS.length} weapon rooms on this server.`
            );
            const MESSAGES = await DISCORD.getOldMessages(CHANNELS[0]);
            for (let message of MESSAGES) {
              await DISCORD.deleteMessage(message);
            }
            refresh(SERVER);

            await interaction.reply({
              content: `Forced refresh of server "${SERVER.name}"...`,
              flags: 64, // MessageFlags.Ephemeral
            });
          } else {
            console.error(
              'There is no "Weapons" channel in the Discord server.'
            );
            await interaction.reply({
              content: `Error: No "Weapons" lobby found on server ${SERVER_ID}.`,
              flags: 64, // MessageFlags.Ephemeral
            });
          }
        } else {
          console.error(`Error: Server ${SERVER_ID} not found.`);
          await interaction.reply({
            content: `Error: Server ${SERVER_ID} not found.`,
            flags: 64, // MessageFlags.Ephemeral
          });
        }
      });
      break;
    case "ebp_admin_sync":
      // Verify that this is the bot administrator
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: "Synchronizing with the API...",
        flags: 64, // MessageFlags.Ephemeral
      });

      checkWeaponsDataFromAPI(() => {
        interaction.followUp({
          content: "Synchronization with the API complete.",
          flags: 64, // MessageFlags.Ephemeral
        });
      });
      break;
    case "ebp_refresh_all":
      // Verify that this is the bot administrator
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: "Rafraîchissement de tous les serveurs Discord en cours...",
        flags: 64, // MessageFlags.Ephemeral
      });

      loop();
      break;
    case "ebp_server_owner":
      // Verify that this is the bot administrator
      if (interaction.user.id !== HEYHEYCHICKEN_DISCORD_ID) {
        await interaction.reply({
          content:
            "This command is reserved for the bot administrator (HeyHeyChicken).",
          flags: 64, // MessageFlags.Ephemeral
        });
        return;
      }

      const TARGET_SERVER_ID = interaction.options.getString("server_id");
      const TARGET_SERVER = DISCORD._getServers().find(
        (server) => server.id == TARGET_SERVER_ID
      );

      if (TARGET_SERVER) {
        try {
          const OWNER = await TARGET_SERVER.fetchOwner();

          await interaction.reply({
            content: `The owner of the server "${TARGET_SERVER.name}" is: **[${OWNER.user.username}](https://discordapp.com/users/${OWNER.user.id})**.`,
            flags: 64 | 4, // MessageFlags.Ephemeral + SuppressEmbeds
          });
        } catch (error) {
          console.error("Error retrieving server owner:", error);
          await interaction.reply({
            content: `Error retrieving server owner ${TARGET_SERVER_ID}.`,
            flags: 64, // MessageFlags.Ephemeral
          });
        }
      } else {
        await interaction.reply({
          content: `Error: Server ${TARGET_SERVER_ID} not found.`,
          flags: 64, // MessageFlags.Ephemeral
        });
      }
      break;
  }
});

DISCORD.client.once("clientReady", async () => {
  console.log(
    `Node.JS is connected to the bot: ${DISCORD.client.user.username}.`
  );

  AXIOS.get(API_URL + "weapons_urls").then((response2) => {
    weaponsUrls = response2.data;

    setInterval(() => {
      loop();
    }, 1000 * 60 * 60 * 24); // The script will run every 24 hours.
    checkWeaponsDataFromAPI();
  });
});

DISCORD.client.login(SETTINGS.settings.discord_bot_token);
