//#region Imports

const AXIOS = require("axios"); // Cette librairie me permet de requêter l'API REST d'EBP - EVA Battle Plan.
const PATH = require("path"); // Cette  librairie me permet de créer des chemins d'accès liés à l'OS.
const HTTP = require("http");
const FS = require("fs");
const { EmbedBuilder } = require("discord.js"); // Cette librairie me permet de communiquer avec l'API de Discord.

const Screenshoter = require("./screenshoter");
const Settings = require("./settings");
const Database = require("./database");
const Discord = require("./discord");

//#endregion

//#region Variables

const DEV_MODE = process.argv.slice(2)[0] == "true";
const API_URL = "https://evabattleplan.com/back/api-discord/?route="; // URL de l'API REST d'EBP - EVA Battle Plan.

let weapons; // Ici sera stockée la liste des armes provenant de l'API.
let weaponsUrls; // Ici sera stockée la liste des URL de la page "Armes".
const LANGUAGES = ["en", "fr", "es", "de", "ro"]; // Le bot ne travaillera que sur les channels qui contiennent l'élément 0. L'élément 1 représente la langue devinée du channel.
const SETTINGS = new Settings();
const DISCORD = new Discord(DEV_MODE);
const DATABASE = new Database(API_URL);
const SCREENSHOTER = new Screenshoter(DISCORD, DATABASE);
const WEB_PORT = DEV_MODE ? 3001 : 3000;
const I18N = JSON.parse(
  FS.readFileSync(PATH.join(__dirname, "..", "i18n.json"), "utf8")
);

//#endregion

//#region Web server

/**
 * Ce serveur web indique à l'utilisateur si le bot est en ligne.
 + URL : https://discord-weapons-bot.ebp.gg/
 */
const SERVER = HTTP.createServer((req, res) => {
  if (req.url === "/") {
    const SVG_PATH = PATH.join(__dirname, "assets/online.svg");

    FS.readFile(SVG_PATH, (err, data) => {
      // Si le chargement de l'image rencontre un souci, on affiche un texte.
      if (err) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("EBP's Discord weapons bot is <b>online</b>.");
        return;
      }
      // On affiche un SVG indiquant que le serveur est en ligne.
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
  console.log(`Serveur HTTP en écoute sur le port "${WEB_PORT}".`);
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
 * Cette fonction rafraichit les informations des armes dans un serveur.
 * @param {*} server Serveur à rafraichir.
 */
async function refresh(server) {
  console.log(`        Server: "${server.name}"`);
  // On récupère les channels qui souhaitent contenir les
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

      // On filtre les anciens messages pour ne garder que les messages envoyés par le BOT.
      const OLD_BOT_MESSAGES = OLD_MESSAGES.filter(
        (x) =>
          x.author.bot &&
          x.author.username == DISCORD.client.user.username &&
          x.author.discriminator == DISCORD.client.user.discriminator
      );
      let nbMessageSend = 0; // Cette variable représente le nombre de messages envoyés sur le channel.

      for (const WEAPON of weapons) {
        const DATE = new Date(WEAPON.date);
        const DATE_STRING =
          ("0" + DATE.getDate()).slice(-2) +
          "/" +
          ("0" + DATE.getMonth() + 1).slice(-2) +
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
        ); // On cherche un ancien message en rapport avec cette arme.

        const IMAGE = await DATABASE.selectImage(WEAPON.name, LANGUAGE);
        if (IMAGE) {
          if (OLD_BOT_MESSAGE) {
            allowAddNewWeapon = false;
            if (OLD_BOT_MESSAGE.embeds[0]) {
              const OLD_DATE_STRING = OLD_BOT_MESSAGE.embeds[0].footer.text;
              // On verrifie que les données de l'arme sont à jour sur ce channel.
              if (DATE_STRING != OLD_DATE_STRING) {
                try {
                  await await OLD_BOT_MESSAGE.edit({
                    embeds: [
                      embedBuilder(
                        WEAPON.name,
                        DATE_STRING,
                        IMAGE.url,
                        weaponsUrls[LANGUAGE] + "?w=" + encodeURI(WEAPON.name)
                      ),
                    ],
                  });
                } catch (e) {
                  console.error(
                    `        Impossible de modifier le messages (Server: "${server.name}", channel: "${CHANNEL.name}").`,
                    e
                  );
                }
              }
            }
          }
          if (allowAddNewWeapon) {
            // On envoie un message contenant les dernières infos de l'arme.

            if (
              await DISCORD.sendMessage(
                CHANNEL,
                "",
                embedBuilder(
                  WEAPON.name,
                  DATE_STRING,
                  IMAGE.url,
                  weaponsUrls[LANGUAGE] + "?w=" + encodeURI(WEAPON.name)
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

      // On envoie le message final.
      const OLD_FINAL = OLD_BOT_MESSAGES.filter((x) =>
        x.content.startsWith("─────────────")
      );
      if (nbMessageSend > 0 || OLD_FINAL.length == 0) {
        OLD_FINAL.forEach((message) => {
          try {
            message.delete();
          } catch (e) {
            console.error(
              `        Impossible de supprimer le messages (Server: "${server.name}", channel: "${CHANNEL.name}").`,
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
              `<https://github.com/HeyHeyChicken/BattlePlan-Discord-weapons-bot>`,
          });
        } catch (e) {
          console.error(
            `        Impossible d'envoyer un message (Server: "${server.name}", channel: "${CHANNEL.name}").`,
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
    ); // On télécharge les screenshots.

    console.log("Refreshed.");
    if (callback) {
      callback();
    }
  });
}

/**
 * Fonction principale.
 */
async function loop() {
  console.log("Loop start...");
  checkWeaponsDataFromAPI(() => {
    // On boucle sur les serveurs Discord utilisant le bot.
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

// Si un utilisateur envoie un message.
DISCORD.client.on("messageCreate", async (message) => {
  // On ignore les messages du bot.
  if (message.author.bot) return;

  // On vérifie que l'utilisateur a les permissions d'administrateur.
  if (
    ((!DEV_MODE && message.content == "!ebp_refresh") ||
      (DEV_MODE && message.content == "!dev_ebp_refresh")) &&
    message.member.permissions.has("ADMINISTRATOR")
  ) {
    const SERVER = DISCORD._getServers().find((x) => x.id == message.guildId);

    const CHANNEL = Array.from(
      SERVER.channels.cache.filter((channel) => channel.id == message.channelId)
    ).map((x) => x[1]);
    if (SERVER && CHANNEL.length == 1) {
      console.log(
        `"${message.author.globalName}" asked for a manual refresh for the: "${SERVER.name}" server.`
      );
      refresh(SERVER);
    }
    DISCORD.deleteMessage(message);
  }
  // Si l'administrateur demande la liste des serveurs utilisant le bot.
  else if (message.content == "!ebp_admin_list") {
    if (message.author.id == 195958479394045952 /* HeyHeyChicken */) {
      const SERVERS = DISCORD._getServers().map(
        (server) => server.name + " (" + server.id + ")"
      );
      console.log(SERVERS);
      message.delete();
    }
    DISCORD.deleteMessage(message);
  }
  // Si l'administrateur du bot force le refresh d'un serveur.
  else if (message.content.startsWith("!ebp_admin_refresh ")) {
    if (message.author.id == 195958479394045952 /* HeyHeyChicken */) {
      checkWeaponsDataFromAPI(async () => {
        const SERVER_ID = message.content.split(" ").at(-1);
        const SERVER = DISCORD._getServers().find(
          (server) => server.id == SERVER_ID
        );
        if (SERVER) {
          const CHANNELS = DISCORD._getServerChannels(SERVER).filter(
            (channel) =>
              channel.topic && channel.topic.includes("#EBP_WEAPONS_BOT(")
          );
          if (CHANNELS.length > 0) {
            console.log(`Il y a ${CHANNELS.length} salons d'armes dans ce serveur.`);
            const MESSAGES = await DISCORD.getOldMessages(CHANNELS[0]);
            for (let message of MESSAGES) {
              await DISCORD.deleteMessage(message);
            }
            refresh(SERVER);
          } else {
            console.error('Aucun salon "Armes" dans le serveur Discord.');
          }
          // !ebp_admin_refresh 862027894401925130
        } else {
          console.error("Aucun serveur Discord utilisant cet ID trouvé.");
        }
        DISCORD.deleteMessage(message);
      });
    }
  }
  // Si l'administrateur du bot force la synchronisation avec l'API.
  else if (message.content == "!ebp_admin_sync") {
    if (message.author.id == 195958479394045952 /* HeyHeyChicken */) {
      checkWeaponsDataFromAPI(() => {
        DISCORD.deleteMessage(message);
      });
    }
  }
  // Si l'administrateur du bot force le refresh de tout les serveurs Discord.
  else if (message.content == "!ebp_refresh_all") {
    if (message.author.id == 195958479394045952 /* HeyHeyChicken */) {
      loop();
    }
  }
  // Si l'administrateur du bot souhaite déterminer le pseudo du propriétaire d'un serveur Discord.
  else if (message.content.startsWith("!ebp_server_owner ")) {
    if (message.author.id == 195958479394045952 /* HeyHeyChicken */) {
      const SERVER_ID = message.content.split(" ").at(-1);
      const SERVER = DISCORD._getServers().find(
        (server) => server.id == SERVER_ID
      );
      if (SERVER) {
        const OWNER = await SERVER.fetchOwner();
        console.log(`Pseudo : ${OWNER.user.username}`);
      }
    }
  }
});

DISCORD.client.once("ready", async () => {
  console.log(
    `Node.JS est connecté avec le bot : ${DISCORD.client.user.username}.`
  );

  AXIOS.get(API_URL + "weapons_urls").then((response2) => {
    weaponsUrls = response2.data;

    setInterval(() => {
      loop();
    }, 1000 * 60 * 60 * 24); // Le script s'executera toutes les 24h.
    checkWeaponsDataFromAPI();
  });
});

DISCORD.client.login(SETTINGS.settings.discord_bot_token);
