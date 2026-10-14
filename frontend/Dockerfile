# ==============================================================================
# FreshRoute OS — Frontend Dockerfile (Node 20 + React 18 + Vite)
# ==============================================================================
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy frontend source code
COPY . .

ENV VITE_API_BASE_URL=http://localhost:8000/api/v1

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
