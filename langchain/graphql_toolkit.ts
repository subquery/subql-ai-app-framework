import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { type ToolInterface, BaseToolkit } from "@langchain/core/tools";
import { renderTemplate } from "@langchain/core/prompts";
import {
  InfoGraphqlTool,
  ListTablesGraphqlTool,
  QueryCheckerTool,
  QueryGraphqlTool,
} from "./graphql_tool";
// import { SQL_PREFIX, SQL_SUFFIX } from "./prompt.js";
// import { LLMChain } from "../../../chains/llm_chain.js";
import { ZeroShotAgent, ZeroShotCreatePromptArgs } from 'langchain/agents'
// import { ZeroShotAgent, ZeroShotCreatePromptArgs } from "../../mrkl/index.js";
// import { AgentExecutor } from "../../executor.js";

/**
 * Interface that extends ZeroShotCreatePromptArgs and adds an optional
 * topK parameter for specifying the number of results to return.
 */
export interface SqlCreatePromptArgs extends ZeroShotCreatePromptArgs {
  /** Number of results to return. */
  topK?: number;
}

/**
 * Class that represents a toolkit for working with SQL databases. It
 * initializes SQL tools based on the provided SQL database.
 * @example
 * ```typescript
 * const model = new ChatOpenAI({});
 * const toolkit = new SqlToolkit(sqlDb, model);
 * const executor = createSqlAgent(model, toolkit);
 * const result = await executor.invoke({ input: 'List the total sales per country. Which country's customers spent the most?' });
 * console.log(`Got output ${result.output}`);
 * ```
//  */
// export class SqlToolkit extends BaseToolkit {
//   tools: ToolInterface[];

//   constructor(private endpoint: string, llm?: BaseLanguageModelInterface) {
//     super();
//     this.tools = [
//       new QueryGraphqlTool(endpoint),
//       new InfoGraphqlTool(endpoint),
//       new ListTablesGraphqlTool(endpoint),
//       new QueryCheckerTool({ llm }),
//     ];
//   }
// }

// export function createSqlAgent(
//   llm: BaseLanguageModelInterface,
//   toolkit: SqlToolkit,
//   args?: SqlCreatePromptArgs
// ) {
//   const {
//     // prefix = SQL_PREFIX,
//     // suffix = SQL_SUFFIX,
//     inputVariables = ["input", "agent_scratchpad"],
//     topK = 10,
//   } = args ?? {};
//   const { tools } = toolkit;
//   // const formattedPrefix = renderTemplate(prefix, "f-string", {
//   //   // dialect: toolkit.dialect,
//   //   top_k: topK,
//   // });

//   const prompt = ZeroShotAgent.createPrompt(tools, {
//     // prefix: formattedPrefix,
//     // suffix,
//     inputVariables,
//   });
//   const chain = new LLMChain({ prompt, llm });
//   const agent = new ZeroShotAgent({
//     llmChain: chain,
//     allowedTools: tools.map((t) => t.name),
//   });
//   return AgentExecutor.fromAgentAndTools({
//     agent,
//     tools,
//     returnIntermediateSteps: true,
//   });
// }
