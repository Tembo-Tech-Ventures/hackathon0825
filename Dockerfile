FROM node:18-slim AS development

# Add bullseye repo to fetch libssl1.1
RUN apt-get update \
 && apt-get install -y wget gnupg \
 && echo "deb http://deb.debian.org/debian bullseye main" >> /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y libssl1.1 openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

RUN npm build

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "start"]
