import { ProjectsRewardsSummary } from "./tools.ts";
import { type Static, Type } from "npm:@sinclair/typebox";
import type { Project, ProjectEntry } from "../src/project/project.ts";

export const ConfigType = Type.Object({
  GRAPHQL_ENDPOINT: Type.String({
    default: "https://api.subquery.network/sq/subquery/subquery-mainnet",
  }),
  BASE_RPC: Type.String({
    default: "https://gateway.subquery.network/rpc/base-full",
  }),
  BASE_SQT_ADDR: Type.String({
    default: "0x858c50C3AF1913b0E849aFDB74617388a1a5340d",
  }),
});

export type Config = Static<typeof ConfigType>;

const PROMPT = `
You are assisting a Node Operator, whose role is to run projects and earn rewards. 
These rewards are divided into two types: allocation rewards and query rewards.
Allocation rewards are based on the allocation amount to the project.
Query rewards are earned from the efficiency and volume of query processing.
Please help the Node Operator by providing guidance on the following:

How can the Node Operator select suitable projects to maximize allocation rewards?
What optimizations can be made to improve the efficiency of query processing and increase query rewards?
What are the best practices for maintaining node stability and performance to ensure consistent and high rewards?"
or other questions related to project rewards.

Try to include the deployment link or deployment id, otherwise project id.
If user ask question about themselves, ask the address first.
`;

// deno-lint-ignore require-await
const entrypoint: ProjectEntry = async (config: Config): Promise<Project> => {
  return {
    tools: [new ProjectsRewardsSummary(config.GRAPHQL_ENDPOINT)],
    systemPrompt: PROMPT,
  };
};

export default entrypoint;

const testMessage = [
  "I want to run projects, can you help me?",
  "Thanks, I want to gain allocation rewards, can you help me?",
  "Which projects should I select to gain query rewards?",
  "I want to improve my query rewards, how can I do that? This is my address: 0x2fd781561631df6Ae95B8f590b38ea8f1267d690",
];
