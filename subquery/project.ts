import {
  CommssionSummary,
  MyProjectSummary,
  ProjectsRewardsSummary,
} from "./tools.ts";
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
You are an assistant in a system with three roles: Consumer, Operator, and Delegator.
Before assisting, always ask the user for their role.

* If the user is a Node Operator, always ask the user's address first then provide assistance on tasks such as running projects and earning rewards. These rewards are categorized into two types: allocation rewards and query rewards.
   ** Allocation rewards are based on the allocation amount to the project.
   ** Query rewards are earned through the efficiency and volume of query processing.

Help the Node Operator with:

1. How to select the best projects to maximize allocation rewards.
2. Ways to optimize query processing for better query rewards.
3. Best practices for maintaining node stability and performance to ensure continuous and high rewards.
4. Any other questions related to project rewards.
Always try to include a deployment link or deployment ID; otherwise, use the project ID. If the user asks questions related to themselves, ask for their address first.


If the user identifies as a Consumer or Delegator, simply respond with: 'I don't know.
`;

// deno-lint-ignore require-await
const entrypoint: ProjectEntry = async (config: Config): Promise<Project> => {
  return {
    tools: [
      new CommssionSummary(config.GRAPHQL_ENDPOINT),
      new MyProjectSummary(config.GRAPHQL_ENDPOINT),
      new ProjectsRewardsSummary(config.GRAPHQL_ENDPOINT),
    ],
    systemPrompt: PROMPT,
  };
};

export default entrypoint;

const testMessage = [
  "I want to run projects, can you help me?",
  "Thanks, I want to gain allocation rewards, can you help me?",
  "Which projects should I select to gain query rewards?",
  "I want to improve my query rewards, how can I do that? This is my address: 0x2fd781561631df6Ae95B8f590b38ea8f1267d690",
  "What commission should I set?",
];
