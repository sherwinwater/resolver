# Use the official Node.js 16 image as the base image
FROM node:latest
RUN npm config set registry https://registry.npmjs.org/
RUN npm cache clean --force
# Install necessary dependencies for running Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    xvfb firefox-esr \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set up the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install Node.js dependencies
RUN npm update
RUN npm install
RUN npx puppeteer browsers install firefox

# Install Playwright dependencies for Linux
RUN npx playwright install-deps

# Install WebKit browser binary
RUN npx playwright install webkit
npx playwright test --headed
# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
# CMD ["npm", "run","start"]
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x1024x16 & export DISPLAY=:99 && npm run start && tail -f /dev/null"]
