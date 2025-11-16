# Use an ARM-compatible base image.
FROM node:20-bullseye-slim

# Install the required dependencies for Puppeteer.
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

# Create an application directory.
WORKDIR /usr/src/app

# Clone the repository.
RUN git clone https://github.com/HeyHeyChicken/EBP-Discord-bot.git

# Install the dependencies.
WORKDIR /usr/src/app/EBP-Discord-bot
RUN npm install

# Set permissions for Chromium.
RUN chmod -R o+rx /usr/src/app/EBP-Discord-bot/node_modules/

# Share the settings.json file.
COPY settings.json /usr/src/app/EBP-Discord-bot/settings.json

# Expose the port if necessary (e.g., 3000)
EXPOSE 3000

# Command to start the application.
WORKDIR /usr/src/app/EBP-Discord-bot/src
CMD ["node", "index.js"]