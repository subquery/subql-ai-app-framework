

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

- Ollama3.1
- Mistral-nemo
- Mistral

#### Unsupported Models

- Gemma2
