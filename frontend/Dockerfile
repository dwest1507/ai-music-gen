FROM node:20-alpine

WORKDIR /app

# Install dependencies as root (standard practice)
COPY --chown=node:node package*.json ./
RUN npm install

# Copy application source and set ownership to 'node' user
COPY --chown=node:node . .

# Switch to the non-root 'node' user
USER node

CMD ["npm", "run", "dev"]
