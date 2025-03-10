const DOCKER_COMPOSE = `services:
  subql-ai:
    image: subquerynetwork/subql-ai-app:latest
    ports:
      - 7827:7827
    restart: unless-stopped
    volumes:
      - .:/app
    command:
      # This is your project manifest file
      - -p=/app/manifest.ts
      # The external Ollama RPC
      - -h=http://host.docker.internal:11434

  # A simple chat UI
  ui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - 8080:8080
    restart: always
    environment:
      - "OPENAI_API_BASE_URLS=http://subql-ai:7827/v1"
      - "OPENAI_API_KEYS=foobar"
      - "WEBUI_AUTH=false"
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
`;

export default DOCKER_COMPOSE;
