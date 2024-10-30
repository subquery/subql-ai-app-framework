## Subquery AI App Framework

[![JSR](https://jsr.io/badges/@subql/ai-app-framework)](https://jsr.io/@subql/ai-app-framework)

## Get Started

You can get started with detailed documentation found
[here](https://academy.subquery.network/ai/welcome.html).

## Installing CLI

Install the latest:

`deno install -g -f --allow-env --allow-sys --allow-net --allow-import --allow-read --allow-write --allow-ffi --allow-run --unstable-worker-options --no-prompt -n subql-ai jsr:@subql/ai-app-framework/cli`

Install a specific version:

`deno install -g -f --allow-env --allow-sys --allow-net --allow-import --allow-read --allow-write --allow-ffi --allow-run --unstable-worker-options --no-prompt -n subql-ai jsr:@subql/ai-app-framework@<version>/cli`

`NOTE: These permissions can change, for the most upto date permissions see the top of ./src/index.ts`

## Development

The framework is build using [Deno](https://deno.land), please make sure that is
available in your environment.

### Tests

Running tests: `deno run test`

## Releases

Releases are made through git tags with semver format prefixed with a `v`. This
will trigger publishing to JSR and Docker hub.
