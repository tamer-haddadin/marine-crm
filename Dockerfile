FROM node:18 AS build
# Set working directory
WORKDIR /app

# Copy root package.json first
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Install client dependencies and build
RUN cd client && npm install && npm run build

# Debug - list directories to find where the build output is
RUN find /app -name "dist" -type d | sort
RUN ls -la /app/dist || echo "No /app/dist directory found"

# Run stage
FROM node:18-slim

WORKDIR /app

# Copy ALL package files including devDependencies
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

# Copy dist folder which contains both client assets and server code
COPY --from=build /app/dist ./dist

# Expose port for Cloud Run
EXPOSE 8080

# Add environment variable for production
ENV NODE_ENV=production

# Start command pointing to the index.js in dist folder
CMD ["node", "dist/index.js"]
