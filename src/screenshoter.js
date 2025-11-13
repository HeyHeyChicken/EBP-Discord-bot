//#region Imports

const PUPPETEER = require("puppeteer"); // Cette librairie me permet de télécharger les screenshots des armes.
const FS = require("fs"); // Cette librairie me permet de travailler avec des fichiers locaux.
const PATH = require("path"); // Cette  librairie me permet de créer des chemins d'accès liés à l'OS.

//#endregion

/**
 * Cette classe a pour but de télécharger les screenshots des armes dans toutes les langues.
 */
class Screenshoter {
  constructor(discord, database) {
    this._discord = discord;
    this._database = database;

    // On s'assure qu'il existe un dossier pour stocker les captures d'écran de chaque armes.
    this.screenshotsFolder = PATH.join(__dirname, "screenshots");
    FS.mkdirSync(this.screenshotsFolder, { recursive: true });
  }

  prepare_urls(weapons, weaponsUrls, languages) {
    // On prépare la liste des URLs à scanner pour créer les screenshots de chaque armes, pour chaque langues.
    const SCREENSHOT_URLS = [];
    for (const LANGUAGE of languages) {
      for (let weapon of weapons) {
        SCREENSHOT_URLS.push([
          PATH.join(
            this.screenshotsFolder,
            (LANGUAGE + "_" + weapon.name).toUpperCase() + ".png"
          ),
          weaponsUrls[LANGUAGE] +
            "/" +
            weapon.name.toLowerCase().replaceAll(" ", "-") +
            "?discord=1",
        ]);
      }
    }
    return SCREENSHOT_URLS;
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

  /**
   * Cette fonction permet de récupérer les captures d'écran des pages d'armes.
   * @param {*} urls Liste des armes et des URLs associées par langue.
   */
  async download_screenshots(weapons, urls) {
    console.log("    Downloading screenshots...");

    const DISCORD_SERVER = this._discord
      ._getServers()
      .find((server) => server.id == this._discord.ebpServerId);
    if (DISCORD_SERVER) {
      const DISCORD_CHANNEL = this._discord
        ._getServerChannels(DISCORD_SERVER)
        .find((channel) => channel.id == this._discord.ebpDevChannelId);
      if (DISCORD_CHANNEL) {
        const OLD_DEV_MESSAGES = await this._discord.getOldMessages(
          DISCORD_CHANNEL,
          200
        );

        const SCREEN_WIDTH = 1920 * 0.9;
        const SCREEN_HEIGHT = 1080 * 0.9;
        const BROWSER = await PUPPETEER.launch({
          executablePath: "/usr/bin/chromium", // spécifiez le chemin de Chromium
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          headless: "shell", // Pour ne pas afficher le navigateur.
          defaultViewport: null, // Nécessaire pour définir la taille.
        });
        const PAGE = await BROWSER.newPage();
        await PAGE.setViewport({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

        for (let i = 0; i < urls.length; i++) {
          const INFOS = urls[i][0]
            .split("\\")
            .at(-1)
            .split("/")
            .at(-1)
            .slice(0, -4);
          const SPLITTED_INFOS = INFOS.split("_");
          const WEAPON = weapons.find(
            (weapon) => weapon.name.toUpperCase() == SPLITTED_INFOS[1]
          );
          const FORMATED_WEAPON_DATE = this._discord.dateFormat(WEAPON.date);
          const OLD_DEV_MESSAGE = OLD_DEV_MESSAGES.find(
            (message) => message.content == INFOS + "\n" + FORMATED_WEAPON_DATE
          );

          if (
            !OLD_DEV_MESSAGE ||
            (OLD_DEV_MESSAGE &&
              OLD_DEV_MESSAGE.content.split("\n").at(-1) !=
                FORMATED_WEAPON_DATE)
          ) {
            console.log(
              `        (${("0" + (i + 1)).slice(-2)}/${(
                "0" + urls.length
              ).slice(-2)}) Downloading: ${urls[i][1]}`
            );

            await PAGE.goto(urls[i][1], { waitUntil: "domcontentloaded" });
            await this._delay(1000); // On attends par mesure de sécurité que le loader soit parti.
            // On prends une capture d'écran
            await PAGE.screenshot({
              path: urls[i][0],
              fullPage: false,
            });

            if (
              await this._discord.deleteWeaponMessage(
                OLD_DEV_MESSAGES,
                INFOS,
                WEAPON.date
              )
            ) {
              const URL = await this._discord._sendImageToTmpServer(
                DISCORD_CHANNEL,
                INFOS,
                WEAPON.date,
                urls[i][0]
              );
              this._database.setImage(
                SPLITTED_INFOS[1].toLowerCase(),
                SPLITTED_INFOS[0].toLowerCase(),
                URL
              );
            } else {
              const OLD = OLD_DEV_MESSAGES.find(
                (message) =>
                  message.content == INFOS + "\n" + FORMATED_WEAPON_DATE
              );
              this._database.setImage(
                SPLITTED_INFOS[1].toLowerCase(),
                SPLITTED_INFOS[0].toLowerCase(),
                OLD.attachments.first().proxyURL
              );
            }
          } else if (
            OLD_DEV_MESSAGE &&
            OLD_DEV_MESSAGE.content.split("\n").at(-1) == FORMATED_WEAPON_DATE
          ) {
            const OLD = OLD_DEV_MESSAGES.find(
              (message) =>
                message.content == INFOS + "\n" + FORMATED_WEAPON_DATE
            );
            this._database.setImage(
              SPLITTED_INFOS[1].toLowerCase(),
              SPLITTED_INFOS[0].toLowerCase(),
              OLD.attachments.first().proxyURL
            );
          }
        }
        await BROWSER.close();
      }
    }

    console.log("    Screenshots downloaded.");
  }
}

module.exports = Screenshoter;
