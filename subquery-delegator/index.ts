import { RunWithTools } from "../llama-tool"
import { LanceStorage } from "../src/storage";
import { FunctionTool } from "../src/tool";
import { grahqlRequest } from "../utils";
import { formatEther } from 'ethers';


const PROMPT = `
You are an agent designed to help a user with their token delegation on the SubQuery Network.
Given an input question, use the available tools to answer the users question.
You answer must use the result of the tools available.
If you need more information to answer the question, ask the user for more details.
All token amounts are in SQT units.

If the question seems to be unrelated to the API, just return "I don't know" as the answer.
`;


const ENDPOINT = 'https://api.subquery.network/sq/subquery/subquery-mainnet'

type Amount = {
  era: number;
  value: { type: 'bigint', value: string };
  valueAfter: { type: 'bigint', value: string };
}

class TotalDelegationTool extends FunctionTool {

  constructor(readonly endpoint: string) {
    super();
  }

  name = 'total-delegation-amount';
  description = `This tool gets the total delegation amount of SQT for the given user address.
  If no delegation is found it will return null.
  `;
  parameters = {
    type: 'object',
    required: ['account'],
    properties: {
      account: {
        type: 'string',
        description: 'The account or address of the user which to get delegation information for',
      }
    },
  }

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<{ delegator: null | { totalDelegations: Amount } }>(this.endpoint, `{
        delegator(id: "${account}") {
          totalDelegations
        }
      }`);

      if (!res.delegator) {
        return null;
      }

      return formatEther(res.delegator.totalDelegations.valueAfter.value)
    } catch (error) {
      return `${error}`;
    }
  }
}

class DelegatedIndexersTool extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  name = 'delegated-indexers';
  description = `This tool gets the addresses of indexers that the given account has delegated to.
  Returns a json array with each item containing the indexer id and the amount delegated.
  `;
  parameters = {
    type: 'object',
    required: ['account'],
    properties: {
      account: {
        type: 'string',
        description: 'The account or address of the user which to get delegation information for',
      }
    },
  }

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<{ delegator: null | { delegations: { nodes: { indexerId: string; amount: Amount}[]}} }>(this.endpoint, `{
        delegator(id: "${account}") {
          delegations {
            nodes {
              indexerId
              amount
            }
          }
        }
      }`);

      if (!res.delegator) {
        return null;
      }

      return JSON.stringify(res.delegator.delegations.nodes
        .filter(delegation => delegation.amount.valueAfter.value !== '0x00')
        .map(delegation => ({
          indexerId: delegation.indexerId,
          amount: formatEther(delegation.amount.valueAfter.value)
        })));
    } catch (error) {
      return `${error}`;
    }
  }
}

class UnclaimedDelegatorRewards extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  name = 'unclaimed-delegator-rewards';
  description = `This tool gets the amount of unclaimed rewards and the indexers that those rewards are from for a given account.
    If there are no results you should tell the user there are "No unclaimed rewards".
    Returns a json array with each item containing the indexer id and the amount of the reward.
  `;
  parameters = {
    type: 'object',
    required: ['account'],
    properties: {
      account: {
        type: 'string',
        description: 'The account or address of the user which to get delegation information for',
      }
    },
  }

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<{ unclaimedRewards: { nodes: { indexerAddress: string; amount: string}[]}}>(this.endpoint, `{
        unclaimedRewards(filter: { delegatorId: { equalTo: "${account}"}}) {
          nodes {
            indexerAddress
            amount

          }
        }
      }`);

      return JSON.stringify(res.unclaimedRewards.nodes
        .filter(reward => reward.amount !== '0')
        .map(reward => ({
          indexerId: reward.indexerAddress,
          amount: formatEther(reward.amount)
        })));
    } catch (error) {
      return `${error}`;
    }
  }
}


// Get balance
// Get inactive delegators
// Suggest changing indexers
// Get est apy

const tools = [
  new TotalDelegationTool(ENDPOINT),
  new DelegatedIndexersTool(ENDPOINT),
  new UnclaimedDelegatorRewards(ENDPOINT),
];

async function run(prompt: string) {
  const storage = await LanceStorage.create('./.db', 'vectors');
  RunWithTools(prompt, tools, storage, PROMPT);
}

run('What is my delegation?');


