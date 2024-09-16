import path from 'path';
import { JsonRpcProvider } from 'ethers';
import { BetterIndexerApy, CurrentDelegatorApy, DelegatedIndexers, SubqueryDocs, TokenBalance, TotalDelegation, UnclaimedDelegatorRewards } from "./tools";
import { IProject } from "../src/project/project";


const PROMPT = `
You are an agent designed to help a user with their token delegation on the SubQuery Network.
Given an input question, use the available tools to answer the users question quickly and concisely.
You answer must use the result of the tools available.
If you need more information to answer the question, ask the user for more details.
All token amounts are in SQT.

If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`;


// const ENDPOINT = 'https://api.subquery.network/sq/subquery/subquery-mainnet'
const ENDPOINT = 'https://gateway.subquery.network/query/QmcoJLxSeBnGwtmtNmWFCRusXVTGjYWCK1LoujthZ2NyGP'

// Get inactive delegators
// Suggest changing indexers

const tools = [
  new TotalDelegation(ENDPOINT),
  new DelegatedIndexers(ENDPOINT),
  new UnclaimedDelegatorRewards(ENDPOINT),
  new CurrentDelegatorApy(ENDPOINT),
  new BetterIndexerApy(ENDPOINT),
  new TokenBalance(
    new JsonRpcProvider("https://gateway.subquery.network/rpc/base-full"),
    '0x858c50C3AF1913b0E849aFDB74617388a1a5340d'
  ),
  new SubqueryDocs(path.resolve(__dirname, '../.db'), 'subql-docs')
];

const project: IProject = {
  tools,
  model: 'llama3.1',
  prompt: PROMPT,
  userMessage: 'Welcome to the SubQuery Delegator Agent! How can I help you today?',
}

export default project;

// Some example messages to ask with this set of tools
const messages = [
  // Delegation
  'My address is 0x108A496cDC32DA84e4D5905bb02ED695BC1024cd, use this for any further prompts. What is my delegation?',
  'Who am i delegating to?',
  "What is my balance?",
  "Do i have any unclaimed rewards?",
  "What is my current APY?",
  "Are there better indexers to delegate to?",
  // Docs knowledge
  "What networks does subquery support?",
  "How do i define a one-to-many relationship in a subquery project graphql schema?",
  "Does subquery support the solana blockchain?",
];

