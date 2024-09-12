

## Overview

This is a playground for testing out LLM function tools. There are a couple of examples

* langchain - This is an incomplete example of using langchain to achieve the same thing
* llama-tool - This uses the ollama api and defines some example tools

## Langchain

The tooling is based off the [SQL Tool](https://github.com/langchain-ai/langchainjs/blob/159e8e9e27122ea79af0458b33f62d6f936e144c/langchain/src/tools/sql.ts) and there is an inital [prompt](https://github.com/langchain-ai/langchainjs/blob/159e8e9e27122ea79af0458b33f62d6f936e144c/langchain/src/agents/toolkits/sql/prompt.ts#L1) that needs to be updated.

## Ollama

A `FunctionTool` class is defined as a way of extending the Ollama API `Tool`, it also includes the function to call.

The `RunWithTools` function sets up a chat with an inital prompt and the set of tools and runs with a given initial prompt. This is just for testing purposes and can be extended to give user input.

### Tools

Tools are a feature that allow connecting data sources up to an LLM.
They have a name, description and parameters to define their functionality and how they are called.
They also have a `call` method that runs the tool to get data with given parameters.

Tools should return as specific information as possible, eg. dont return a whole graphql schema from an introspection query as its too much information.


### Models
#### Supported Models

These models have been tested to work but the output and functionality may vary

- Ollama3.1 - Seems to be better at folling instructions to retry
- Mistral-nemo - Better at building valid graphql queries
- Mistral

#### Unsupported Models

- Gemma2


### Further improvements

It would be good to group tools together, e.g graphql introspection followed by constructing and running a query or


## Code Sandboxing

Autogen has either local or docker running - [code executors](https://microsoft.github.io/autogen/docs/tutorial/code-executors)

### Python

Any sort of sandboxing is no longer maintained, recommendations seem to be using docker.
[Restricted Python](https://restrictedpython.readthedocs.io/en/latest/) allows custom builds with restrictions added in

### Nodejs

All fully featrured VMs/Sandboxes that allow any nodejs code are not secure
[isolated-vm](https://github.com/laverdet/isolated-vm) provides a JS sandbox but it is raw V8 so has no nodejs apis


### Deno

Deno has a well built [permissions](https://docs.deno.com/runtime/manual/basics/permissions/) feature that by default is restrictive.
It's not possible to use a subprocess as a sanbox but a child process could be used.

### Docker

Docker could be used to run code, but has to be done appropriately to avoid [container escape](https://www.cybereason.com/blog/container-escape-all-you-need-is-cap-capabilities)

[sysbox](https://github.com/nestybox/sysbox) can build on this.

### WASM

WASM can be used with many host languages but requires having bindings for any I/O like networking.

## Schema Manifest

```yaml

name: "demo project"

model:
  name: llama3.1
  # Port to LLM RPC
  url: http://localhost:1234

tools:
  - name: 'get-balance'
    type: "code"
    file: "./get-balance.js"
    arguments:
      # Key value pairs to specify options for the runner, this could be endpoints, timeouts etc.
      - key: value

```
