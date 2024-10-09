import { JsonRpcProvider } from "npm:ethers";
import {
  BetterIndexerApy,
  CurrentDelegatorApy,
  DelegatedIndexers,
  SubqueryDocs,
  TokenBalance,
  TotalDelegation,
  UnclaimedDelegatorRewards,
} from "./tools.ts";
import { type Static, Type } from "npm:@sinclair/typebox";
import type { IProjectEntrypoint } from "../src/project/project.ts";

const ConfigType = Type.Object({
  GRAPHQL_ENDPOINT: Type.String({
    default:
      "https://gateway.subquery.network/query/QmcoJLxSeBnGwtmtNmWFCRusXVTGjYWCK1LoujthZ2NyGP",
  }),
  BASE_RPC: Type.String({
    default: "https://gateway.subquery.network/rpc/base-full",
  }),
  BASE_SQT_ADDR: Type.String({
    default: "0x858c50C3AF1913b0E849aFDB74617388a1a5340d",
  }),
});

type Config = Static<typeof ConfigType>;

const PROMPT = `
You are an agent designed to help a user with their token delegation on the SubQuery Network.
Given an input question, use the available tools to answer the users question quickly and concisely.
You answer must use the result of the tools available.
Do not mention that you used a tool or the name of a tool.
If you need more information to answer the question, ask the user for more details.
All token amounts are in SQT.

If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`;

export const entrypoint: IProjectEntrypoint<typeof ConfigType> = {
  configType: ConfigType,
  // deno-lint-ignore require-await
  projectFactory: async (config: Config) => {
    const tools = [
      new TotalDelegation(config.GRAPHQL_ENDPOINT),
      new DelegatedIndexers(config.GRAPHQL_ENDPOINT),
      new UnclaimedDelegatorRewards(config.GRAPHQL_ENDPOINT),
      new CurrentDelegatorApy(config.GRAPHQL_ENDPOINT),
      new BetterIndexerApy(config.GRAPHQL_ENDPOINT),
      new TokenBalance(
        new JsonRpcProvider(config.BASE_RPC),
        config.BASE_SQT_ADDR,
      ),
      new SubqueryDocs(),
    ];

    return {
      tools,
      model: "llama3.1",
      vectorStorage: {
        type: "lancedb",
        path: "../.db",
      },
      systemPrompt: PROMPT,
      userMessage:
        "Welcome to the SubQuery Delegator Agent! How can I help you today?",
    };
  },
};

// Some example messages to ask with this set of tools
const _messages = [
  // Delegation
  "My address is 0x108A496cDC32DA84e4D5905bb02ED695BC1024cd, use this for any further prompts. What is my delegation?",
  "Who am i delegating to?",
  "What is my balance?",
  "Do i have any unclaimed rewards?",
  "What is my current APY?",
  "Are there better indexers to delegate to?",
  // Docs knowledge
  "What networks does subquery support?",
  "How do i define a one-to-many relationship in a subquery project graphql schema?",
  "Does subquery support the solana blockchain?",
  "How do i swap ksqt for sqt?",
];
