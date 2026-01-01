FROM node:18 AS build
# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build both client (vite) and server (esbuild)
RUN npm run build

# Debug - verify build output
RUN ls -la /app/dist

# Run stage
FROM node:18-slim

WORKDIR /app

# Copy package files and node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

# Copy dist folder (contains both client assets and server code)
COPY --from=build /app/dist ./dist

# Expose port for Cloud Run
EXPOSE 8080

# Add environment variable for production
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/index.js"]
