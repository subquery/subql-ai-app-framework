const README = `# SubQuery AI App Example

## Start

- Read the [documentation](https://academy.subquery.network/ai) to see what
  SubQuery AI can do
- Install dependencies
  - [deno](https://deno.com/)
  - [Ollama](https://ollama.com)
  - subql-ai cli -
    \`deno install -g -f --allow-env --allow-sys --allow-net --allow-import --allow-read --allow-write --allow-ffi --allow-run --unstable-worker-options --no-prompt -n subql-ai jsr:@subql/ai-app-framework/cli\`

## Editing your app

- \`manifest.ts\` - This file defines key configuration options for your app.
  Note: This is converted to JSON when publishing.
- \`project.ts\` - This is where the code for your app lives. It registers any
  tools and your system prompt.

## Run your app

There are 2 ways to run your app locally. Both require you having access to an
[Ollama](https://ollama.com/) RPC, if you have a sufficiently powerful computer
you can run Ollama locally.

### CLI

To start your app: \`subql-ai -p ./manifest.ts\`

To chat with your app using a cli, in another terminal you can run
\`subql-ai repl\`

### Docker Compose

To run your project in docker there is a provided \`docker-compose.yml\` file.
This will start your app as well as a simple chat web UI.

To start everything: \`docker compose up\`.

To use the web UI, head to \`http://localhost:8080\` and create a new chat. From
the list of models select \`subql-ai\` and begin chatting.

## Publish your app

Once your app is ready you can publish it to IPFS to distribute it. This will
bundle up the code and any vector data and upload it to IPFS. Then the app can
be run from IPFS

\`subql-ai publish -p ./manifest.ts\`
`;
export default README;
