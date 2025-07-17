# Start from a Node.js base image
FROM node:22-alpine

# Set working directory
WORKDIR /blaxel

# Copy package files for better caching
COPY package.json package-lock.json /blaxel/
RUN npm install

# Copy application code
COPY . .

# Command to run when container starts, it need to provide a server running on port 80 for agent and MCP server
ENTRYPOINT ["npm", "run", "start:http"]
