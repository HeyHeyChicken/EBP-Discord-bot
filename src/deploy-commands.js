const { REST, Routes } = require("discord.js");
const Settings = require("./settings");

const COMMANDS = [
  {
    name: "ebp_refresh",
    description: "Refresh all information on this server.",
  },
  {
    name: "ebp_admin_list",
    description: "List all servers using the bot (EBP admin only).",
  },
  {
    name: "ebp_admin_refresh",
    description: "Force refresh a specific server (EBP admin only).",
    options: [
      {
        name: "server_id",
        description: "The ID of the server to refresh",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "ebp_admin_sync",
    description: "Force synchronization with the API (EBP admin only).",
  },
  {
    name: "ebp_refresh_all",
    description: "Force refresh all Discord servers (EBP admin only).",
  },
  {
    name: "ebp_server_owner",
    description: "Get the owner of a Discord server (EBP admin only).",
    options: [
      {
        name: "server_id",
        description: "The ID of the server to check",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
];

const SETTINGS = new Settings();
const DISCORD_REST = new REST({ version: "10" }).setToken(
  SETTINGS.settings.discord_bot_token
);

// Déploiement global (fonctionne sur tous les serveurs)
(async () => {
  try {
    console.log("Refreshing of slash commands has begun...");

    await DISCORD_REST.put(Routes.applicationCommands("1295696799839031318"), {
      body: COMMANDS,
    });

    console.log("Slash commands successfully reloaded!");
  } catch (error) {
    console.error(error);
  }
})();
