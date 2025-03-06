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

# Expose the port the app runs on
EXPOSE 4000

# Command to run the app
CMD [ "npm", "run", "start" ]
