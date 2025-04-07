FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Ensure TypeScript is installed globally inside the container
RUN npm install -g typescript

# Bundle app source
COPY . .
# Create public directory and ensure it exists
RUN mkdir -p public

# Build TypeScript
RUN npm run build

EXPOSE 4000
EXPOSE 4001

CMD [ "npm", "run", "start" ]