# Use an official Node.js image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install TypeScript globally
RUN npm install -g typescript

# Copy the entire application, including .env
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the port
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]
