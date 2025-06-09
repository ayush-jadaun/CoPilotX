# Use official Node.js LTS image with glibc (NOT Alpine)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and install deps
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Install ESLint globally for linter tool support
RUN npm install -g eslint

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 3000

# Run app
CMD ["node", "index.js"]