import readline from 'readline/promises'
import { IFunctionTool } from './src/tool';
import { LanceStorage } from './src/storage';
import { Runner } from './src/runner';
import { MockSandbox } from './src/sandbox';
import { RunnerHost } from './src/runnerHost';
import { MemoryChatStorage } from './src/chatStorage';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


const MAX_ITERATIONS = 10;
const DEBUG = true;
// export const MODEL = 'mistral-nemo'; //'llama3.1'
export const MODEL = 'llama3.1'; //'llama3.1'

export function debug(...args: Parameters<typeof console.log>) {
  if (DEBUG) {
    console.log('\x1b[33m[DEBUG]\x1b[0m', ...args);
  }
}
// Defines the overall behaviour
const GRAPHQL_PROMPT = (limit = 100) => `You are an agent designed to interact with a GraphQL API.
Given an input question, create a syntactically correct graphql query to run and use the "query-gql" tool to run that query, then look at the results of the query and return the answer.
Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most ${limit} results using the "first" option.
You can order the results by a relevant field to return the most interesting examples from the API.
Never query for all the fields on a specific type, only ask for a the few relevant fields given the question.
You have access to tools for interacting with the API.
Only use the below tools. Only use the information returned by the below tools to construct your final answer.
If the tools suggest using other tools then you must use the other tools.
You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.

DO NOT make any mutate or subscription queries.

If the question does not seem related to the API, just return "I don't know" as the answer.`

// Defines the overall behaviour
const GRAPHQL_PROMPT2 = () => `You are an agent designed to interact with a GraphQL API.
Given an input question, create a syntactically correct GraphQL query and use the "query-gql" tool to query, then look at the results of the query and return the answer.
You must use the provided tools to better understand more about the Graphql API and improve the graphql query before executing.

You have access to tools for interacting with the API.
Only use the information returned by the tools to construct your final answer.

If you get an error while executing a query, rewrite the query and try again.
If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`

const GRAPHQL_PROMPT3 = (introspetion: string) => `You are an agent designed to interact with a GraphQL API.
The schema for the graphql api is as follows ${introspetion}.

Then given and input question, and using the schema construct a syntactically correct graphql query that answeres the question and use the "query-gql" tool to run that query.
Your answer MUST use the result of the query, or if there is an error, rewrite the query and try again.

If the input question contains any numbers, ids or specific details then do not modify them or their casing in any way.

If the query returns an error, modify the query and try again.
If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`

const GRAPHQL_PROMPT4 = () => `You are an agent designed to interact with a Graphql API to answer questions.

Use the available tools to better understand the capabilities of the API to construct a syntactically correct Graphql Query that answers the users question and then run the query using one of the available tools.
Your answer must be a result of running the graphql query.

Don't provide example queries or code, instead run the query.

If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`

// const HOST = 'http://localhost:11434';
const HOST = 'http://192.168.50.169:11434';
// const HOST = 'https://olla.wk.zohu.vip:8008/';

export async function RunWithTools(prompt: string, tools: IFunctionTool[], storage?: LanceStorage, systemPrompt = GRAPHQL_PROMPT4()): Promise<string> {

  const host = new RunnerHost(async () => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: 'system', content: systemPrompt}]);

    return new Runner(
      MODEL,
      new MockSandbox(tools),
      chatStorage,
      HOST,
    );
  });

  const runner = await host.getRunner('default')

  console.log('Initial prompt: ', prompt)
  const initialResponse = await runner.prompt(prompt);
  console.log(initialResponse);

  while(true) {
    const response = await rl.question("Enter a message: ");

    const res = await runner.prompt(response);
    console.log(res);
  }
}

export async function RunScript(messages: string[], tools: IFunctionTool[], systemPrompt: string): Promise<void> {
  const host = new RunnerHost(async () => {
    const chatStorage = new MemoryChatStorage();

    chatStorage.append([{ role: 'system', content: systemPrompt}]);

    return new Runner(
      MODEL,
      new MockSandbox(tools),
      chatStorage,
      HOST,
    );
  });

  const runner = await host.getRunner('default');

  for (const msg of messages) {
    console.log(`Enter a message: ${msg}`);
    console.log(await runner.prompt(msg));
  }
  console.log('DONE')
}
