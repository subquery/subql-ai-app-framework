import { ChatOllama } from "@langchain/ollama";
import { InfoGraphqlTool, ListTablesGraphqlTool, QueryCheckerTool, QueryGraphqlTool } from "./langchain/graphql_tool";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new ChatOllama({
  model: "llama3.1",  // Default value.
});

const endpoint = 'https://api.subquery.network/sq/subquery/subquery-mainnet';

const tools = [
  new QueryGraphqlTool(endpoint),
  new InfoGraphqlTool(endpoint),
  new ListTablesGraphqlTool(endpoint),
  new QueryCheckerTool({
    llm: model,
  })
]

// const modelWithTools = model.bindTools(tools);




async function run() {
  // const msg = await modelWithTools.invoke('Can you tell me about all the details of delegator with the address 0xe8888fb09cf575c333af560c2b881f761b735e42');

    // Get the prompt to use - you can modify this!
  // If you want to see the prompt in full, you can at:
  // https://smith.langchain.com/hub/hwchase17/react
  const prompt = await pull<PromptTemplate>("hwchase17/react");

  const agent = await createReactAgent({
    llm: model,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const result = await agentExecutor.invoke({
    input: "Can you tell me about all the details of delegator with the address 0xe8888fb09cf575c333af560c2b881f761b735e42",
  });

  console.log("RESULT", result)

}

run()
