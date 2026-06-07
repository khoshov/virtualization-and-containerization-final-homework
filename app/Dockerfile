FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy application source files
COPY . .

# Expose the application port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
