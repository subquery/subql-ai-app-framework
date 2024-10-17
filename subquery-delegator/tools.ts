import {
  type AbstractProvider,
  Contract,
  formatEther,
  formatUnits,
  toBigInt,
} from "npm:ethers";
import { FunctionTool } from "../src/tools/tool.ts";
import { grahqlRequest } from "./utils.ts";
import { RagTool } from "../src/tools/ragTool.ts";

type Amount = {
  era: number;
  value: { type: "bigint"; value: string };
  valueAfter: { type: "bigint"; value: string };
};

export class TotalDelegation extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  // name = 'total-delegation-amount';
  description =
    `This tool gets the total delegation amount of SQT for the given user address.
  If no delegation is found it will return null.
  `;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to get delegation information for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<
        { delegator: null | { totalDelegations: Amount } }
      >(
        this.endpoint,
        `{
        delegator(id: "${account}") {
          totalDelegations
        }
      }`,
      );

      if (!res.delegator) {
        return null;
      }

      return formatEther(res.delegator.totalDelegations.valueAfter.value);
    } catch (error) {
      return `${error}`;
    }
  }
}

export class DelegatedIndexers extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  // name = 'delegated-indexers';
  description =
    `This tool gets the addresses of indexers that the given account has delegated to.
  Returns a json array with each item containing the indexer id, the amount delegated and whether the indexer is active.
  If an indexer is not active the user should be warned and told to change delegators.
  `;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to get delegation information for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<
        {
          delegations: {
            nodes: {
              indexerId: string;
              amount: Amount;
              indexer: { active: boolean };
            }[];
          };
        }
      >(
        this.endpoint,
        `
        query ($capacity: JSON) {
          delegations(filter: { and: [
            { delegatorId: { equalTo: "${account}"}}
            {not: {amount: {contains: $capacity}}}
          ]}) {
            nodes {
              indexerId
              delegatorId
              amount
              indexer {
                active
              }
            }
          }
        }`,
        {
          "capacity": {
            "valueAfter": { "value": "0x00" },
          },
        },
      );

      return JSON.stringify(res.delegations.nodes
        .map((delegation) => ({
          indexerId: delegation.indexerId,
          amount: formatEther(delegation.amount.valueAfter.value),
          active: delegation.indexer.active,
        })));
    } catch (error) {
      return `${error}`;
    }
  }
}

export class UnclaimedDelegatorRewards extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  // name = 'unclaimed-delegator-rewards';
  description =
    `This tool gets the amount of unclaimed rewards and the indexers that those rewards are from for a given account.
    If there are no results you should tell the user there are "No unclaimed rewards".
    Returns a json array with each item containing the indexer id and the amount of the reward.
  `;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to get delegation information for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const res = await grahqlRequest<
        {
          unclaimedRewards: {
            nodes: { indexerAddress: string; amount: string }[];
          };
        }
      >(
        this.endpoint,
        `{
        unclaimedRewards(filter: { delegatorId: { equalTo: "${account}"}}) {
          nodes {
            indexerAddress
            amount

          }
        }
      }`,
      );

      return JSON.stringify(
        res.unclaimedRewards.nodes
          .filter((reward) => reward.amount !== "0")
          .map((reward) => ({
            indexerId: reward.indexerAddress,
            amount: formatEther(reward.amount),
          })),
      );
    } catch (error) {
      return `${error}`;
    }
  }
}

export class TokenBalance extends FunctionTool {
  constructor(
    readonly provider: AbstractProvider,
    readonly tokenAddress: string,
  ) {
    super();
  }

  // name = 'token-balance';
  description =
    `This tool gets the current on chain SQT balance for the given address`;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to get the balance for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      // Step 3: Define the ERC-20 contract ABI (only need the 'balanceOf' function)
      const erc20Abi = [
        "function balanceOf(address owner) view returns (uint256)",
      ];

      const erc20Contract = new Contract(
        this.tokenAddress,
        erc20Abi,
        this.provider,
      );

      const balance = await erc20Contract.balanceOf(account);

      return formatEther(balance);
    } catch (error) {
      return `${error}`;
    }
  }
}

export class CurrentDelegatorApy extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  // name = 'current-delegator-apy';
  description =
    `This gets the current combined delegator APY of a users delegations.`;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to delegation APY for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const apy = await this.rawApy(account);

      return stringNumToPercent(apy);
    } catch (error) {
      return `${error}`;
    }
  }

  async rawApy(account: string): Promise<string> {
    const res = await grahqlRequest<
      { eraDelegatorApies: { nodes: { apy: string; eraIdx: number }[] } }
    >(
      this.endpoint,
      `{
      eraDelegatorApies(
        filter: {delegatorId: {equalTo: "${account}"}}
        orderBy: ERA_IDX_DESC
      ) {
        nodes {
          #id
          #delegatorId
          apy
          eraIdx
        }
      }
    }`,
    );

    const apy = res.eraDelegatorApies.nodes[0]?.apy;

    if (!apy) {
      return "0";
    }

    return apy;
  }
}

// To get from decimal to % we can use 16 instead of 18 decimals
function stringNumToPercent(input: string): string {
  return `${parseInt(formatUnits(input, 16), 10).toFixed(3)}%`;
}

// Further improvements could be
// * checking the capacity is greater than users current balance/current delegation
// * consider more than 1 era to ensure its not a 1 off high apy
// * ignore current delegated indexers,
export class BetterIndexerApy extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  // name = 'better-indexer-apy';
  description = `Finds any available indexer with better APY.
  If there are no results then tell the user "There is no better indexer to delegate to".
  Returns a json object with indexer address as the key and the APY as the value.
  `;
  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to delegation APY for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    try {
      const [currentApy, latestEra] = await Promise.all([
        new CurrentDelegatorApy(this.endpoint).rawApy(account),
        this.getLatestEra(),
      ]);

      const topAvalableDelegators = await this.getTopAvailableDelegators(
        currentApy,
        latestEra,
      );

      return JSON.stringify(topAvalableDelegators);
    } catch (error) {
      return `${error}`;
    }
  }

  private async getLatestEra(): Promise<number> {
    const res = await grahqlRequest<{ eras: { nodes: { id: string }[] } }>(
      this.endpoint,
      `{
      eras(first: 1, orderBy: ID_DESC, filter: {endTime: {isNull: false}}) {
        nodes {
          id
        }
      }
    }`,
    );

    return parseInt(toBigInt(res.eras.nodes[0].id).toString(), 10);
  }

  private async getTopAvailableDelegators(
    currentApy: string = "0",
    era = 28,
  ): Promise<Record<string, string>> {
    const res = await grahqlRequest<
      {
        eraIndexerApies: {
          nodes: { delegatorApy: string; indexerId: string }[];
        };
      }
    >(
      this.endpoint,
      `query($capacity: JSON){
      eraIndexerApies(
        orderBy: DELEGATOR_APY_DESC
        filter: { and: [
          {eraIdx: {greaterThanOrEqualTo: ${era}}}
          { not: { indexer: { capacity: { contains: $capacity }}}}
          { delegatorApy: { greaterThan: "${currentApy}" }}
        ]}
      ) {
        nodes {
          indexerId
          delegatorApy
        }
      }
    }`,
      {
        "capacity": {
          "valueAfter": { "value": "0x00" },
        },
      },
    );

    return res.eraIndexerApies.nodes.reduce((acc, node) => {
      acc[node.indexerId] = stringNumToPercent(node.delegatorApy);
      return acc;
    }, {} as Record<string, string>);
  }
}

export class SubqueryDocs extends RagTool {
  constructor() {
    super("subql-docs", "content");
  }
}
