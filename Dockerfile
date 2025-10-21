# Utiliser une image de base compatible ARM
FROM node:20-bullseye-slim

# Installer les dépendances requises pour Puppeteer
RUN apt-get update && apt-get install -y \
    git chromium \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils \
    libatk-bridge2.0-0 libx11-xcb-dev libxcomposite-dev libxdamage-dev libxext-dev libgbm-dev libxrandr-dev \
    libatspi2.0-0 wget \
    wget && rm -rf /var/lib/apt/lists/*

# Créer un répertoire de l'application
WORKDIR /usr/src/app

# Cloner le dépôt
RUN git clone https://github.com/HeyHeyChicken/EBP-Discord-weapons-bot.git

# Installer les dépendances
WORKDIR /usr/src/app/EBP-Discord-weapons-bot
RUN npm install

# Fixer les autorisations pour Chromium
RUN chmod -R o+rx /usr/src/app/EBP-Discord-weapons-bot/node_modules/

# Partager le fichier settings.json
COPY settings.json /usr/src/app/EBP-Discord-weapons-bot/settings.json

# Expose le port si nécessaire (par exemple, 3000)
EXPOSE 3000

# Commande pour démarrer l'application
WORKDIR /usr/src/app/EBP-Discord-weapons-bot/src
CMD ["node", "index.js"]