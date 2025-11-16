// Copyright (c) 2025, Antoine Duval
// This file is part of a source-visible project.
// See LICENSE for terms. Unauthorized use is prohibited.

//#region Imports

const FS = require("fs");
const PATH = require("path");

//#endregion

/**
 * This class aims to upload screenshots of weapons in all languages.
 */
class Settings {
  constructor() {
    // We retrieve the project settings.
    const SETTINGS_PATH = PATH.join(__dirname, "..", "settings.json");
    if (!FS.existsSync(SETTINGS_PATH)) {
      FS.writeFileSync(
        SETTINGS_PATH,
        JSON.stringify(
          {
            discord_bot_token: "",
          },
          null,
          2
        )
      );
    }
    this.settings = JSON.parse(FS.readFileSync(SETTINGS_PATH, "utf8"));
    if (
      !this.settings.discord_bot_token ||
      this.settings.discord_bot_token.length == 0
    ) {
      throw new Error(
        'You need to define the value of "discord_bot_token" in the "settings.json" file.'
      );
    }
  }
}

module.exports = Settings;
