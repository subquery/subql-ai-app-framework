import dayjs from "dayjs";
import { toChecksumAddress } from "ethereum-checksum-address";
import { BigNumber as BigNumberJs } from "npm:bignumber.js";

// dayjs.extend(utc);

export async function grahqlRequest<T = unknown>(
  endpoint: string,
  query: string,
  variables?: unknown
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const res = await response.json();

  if (res.errors) {
    console.log(`Request failed\n${query}`);

    throw new Error(
      res.errors.map((e: { message: string }) => e.message).join("\n")
    );
  }

  return res.data;
}

export const formatSQT = (
  val: string | bigint,
  options: {
    fixedNum?: number;
    toStringOrNumber?: "string" | "number";
  } = { fixedNum: 6, toStringOrNumber: "number" }
) => {
  const { fixedNum = 6, toStringOrNumber = "number" } = options;
  const transVal = typeof val === "bigint" ? val.toString() : val;
  const result = BigNumberJs(
    BigNumberJs(transVal)
      .div(10 ** 18)
      .toFixed(fixedNum, 1)
  );

  if (toStringOrNumber === "string") {
    return result.toString();
  }
  return result.toNumber();
};

export const getEraInfo = async (endpoint: string) => {
  const res = await grahqlRequest<{
    eras: {
      nodes: {
        eraPeriod: string;
        startTime: Date;
        endTime: Date;
        id: string;
        createdBlock: number;
      }[];
    };
  }>(
    endpoint,
    `
    query {
      eras(orderBy: CREATED_BLOCK_DESC) {
        nodes {
          eraPeriod
          startTime
          endTime
          id
          createdBlock
        }
      }
    }
  `
  );

  const lastestEra = res?.eras?.nodes?.[0];

  const { startTime, eraPeriod: period, id: index, createdBlock } = lastestEra;

  return {
    // covert to utc
    startTime: dayjs(startTime).toDate(),
    estEndTime: dayjs(startTime).add(Number(period), "millisecond").toDate(),
    period: Math.floor(Number(period) / 1000),
    index: parseInt(index),
    lastEra: parseInt(index) - 1,
    createdBlock: createdBlock,
    eras: res?.eras.nodes || [],
  };
};

export const getOperatorDeployment = async (
  endpoint: string,
  address: string,
  lastEra: number
) => {
  const res = await grahqlRequest<{
    indexerDeployments: {
      nodes: {
        deployment: { id: string; project: { id: string; metadata: string } };
      }[];
    };
  }>(
    endpoint,
    `
      query GetDeploymentIndexersDeploymentByIndexer($indexerAddress: String!) {
        indexerDeployments(filter: { indexerId: { equalTo: $indexerAddress } }) {
          nodes {
            deployment {
              id
              project {
                id
                metadata
              }
            }
          }
        }
      }
    `,
    {
      indexerAddress: toChecksumAddress(address),
    }
  );

  const lastEraAllocationInfo = await grahqlRequest<{
    eraIndexerApies: {
      nodes: Array<{
        indexerId: string;
        indexerApy: string;
      }>;
    };
    indexerAllocationRewards: {
      groupedAggregates: Array<{
        keys: Array<string>;
        sum: {
          reward: string;
          burnt: string;
        };
      }>;
    };
  }>(
    endpoint,
    `
      query GetAllocationRewardsByDeploymentIdAndIndexerId($indexerId: String!, $eraIdx: Int!) {
        eraIndexerApies(filter: { eraIdx: { equalTo: $eraIdx }, indexerId: { equalTo: $indexerId } }) {
          nodes {
            indexerId
            indexerApy
          }
        }
        indexerAllocationRewards(filter: { indexerId: { equalTo: $indexerId }, eraIdx: { equalTo: $eraIdx } }) {
          groupedAggregates(groupBy: DEPLOYMENT_ID) {
            sum {
              reward
              burnt
            }
            keys
          }
        }
      }
    `,
    {
      indexerId: toChecksumAddress(address),
      eraIdx: lastEra,
    }
  );

  const lastEraQueryInfo = await grahqlRequest<{
    indexerEraDeploymentRewards: {
      nodes: Array<{
        deploymentId: string;
        totalRewards: string;
        queryRewards: string;
      }>;
    };
    totalRewardsOfDeployment: {
      groupedAggregates: {
        keys: string[];
        sum: {
          totalRewards: string;
        };
      }[];
    };
  }>(
    endpoint,
    `
      query GetAllocationRewardsByDeploymentIdAndIndexerId(
        $indexerId: String!
        $deploymentId: [String!]
        $eraIdx: Int!
      ) {
        indexerEraDeploymentRewards(
          filter: {
            indexerId: { equalTo: $indexerId }
            deploymentId: { in: $deploymentId }
            eraIdx: { equalTo: $eraIdx }
          }
        ) {
          nodes {
            deploymentId
            queryRewards
          }
        }

        totalRewardsOfDeployment: indexerEraDeploymentRewards(
          filter: { indexerId: { equalTo: $indexerId }, deploymentId: { in: $deploymentId } }
        ) {
          groupedAggregates(groupBy: DEPLOYMENT_ID) {
            keys
            sum {
              totalRewards
            }
          }
        }
      }
    `,
    {
      indexerId: toChecksumAddress(address),
      deploymentId: res?.indexerDeployments.nodes.map(
        (d: { deployment: { id: string } }) => d.deployment.id
      ),
      eraIdx: lastEra,
    }
  );

  if (res.indexerDeployments)
    return res.indexerDeployments.nodes.map((deployment) => {
      return {
        deploymentId: deployment.deployment.id,
        projectId: deployment.deployment.project.id,
        lastEraAllocationRewards: formatSQT(
          lastEraAllocationInfo.indexerAllocationRewards.groupedAggregates.find(
            (i) => i.keys[0] === deployment.deployment.id
          )?.sum.reward || "0"
        ),
        lastEraQueryRewards: formatSQT(
          lastEraQueryInfo.indexerEraDeploymentRewards.nodes.find(
            (i) => i.deploymentId === deployment.deployment.id
          )?.queryRewards || "0"
        ),
        apy: BigNumberJs(
          formatSQT(
            lastEraAllocationInfo.eraIndexerApies.nodes.find(
              (i) => i.indexerId === toChecksumAddress(address)
            )?.indexerApy || "0"
          )
        )
          .multipliedBy(100)
          .toFixed(2),
      };
    });

  return [];
};

export const getAllDeployment = async (
  endpoint: string,
  selectEra: number,
  options: {
    sort?:
      | "TOTAL_REWARDS_DESC"
      | "TOTAL_REWARDS_ASC"
      | "ALLOCATION_REWARDS_ASC"
      | "ALLOCATION_REWARDS_DESC"
      | "QUERY_REWARDS_ASC"
      | "QUERY_REWARDS_DESC";
  } = {}
) => {
  const { sort = "TOTAL_REWARDS_DESC" } = options;
  // due to AI limitation, only fetch top 10
  const deployments = await grahqlRequest<{
    eraDeploymentRewards: {
      nodes: { deploymentId: string; totalRewards: string }[];
      totalCount: number;
    };
  }>(
    endpoint,
    `
    query allDeployments($sort: [EraDeploymentRewardsOrderBy!], $currentIdx: Int!, $first: Int! = 100, $offset: Int! = 0) {
      eraDeploymentRewards(
        orderBy: $sort
        filter: { eraIdx: { equalTo: $currentIdx } }
        first: $first
        offset: $offset
      ) {
        nodes {
          deploymentId
          totalRewards
        }
        totalCount
      }
    }
  `,
    {
      currentIdx: selectEra,
      sort,
    }
  );

  const deploymentsInfo = await grahqlRequest<{
    deployments: {
      nodes: {
        id: string;
        metadata: string;
        project: {
          id: string;
          metadata: string;
        };
        indexers: {
          totalCount: number;
        };
      }[];
    };
    indexerAllocationSummaries: {
      groupedAggregates: { keys: string[]; sum: { totalAmount: string } }[];
    };
    deploymentBoosterSummaries: {
      groupedAggregates: { keys: string[]; sum: { totalAmount: string } }[];
    };
    eraDeploymentRewards: {
      groupedAggregates: {
        keys: string[];
        sum: { allocationRewards: string; totalRewards: string };
      }[];
    };
  }>(
    endpoint,
    `
    query allDeploymentsInfomations($deploymentIds: [String!], $currentIdx: Int!) {
      deployments(filter: { id: { in: $deploymentIds } }) {
        nodes {
          id
          metadata
          project {
            id
            metadata
          }
          indexers(filter: { indexer: { active: { equalTo: true } }, status: { notEqualTo: TERMINATED } }) {
            totalCount
          }
        }
      }

      indexerAllocationSummaries(filter: { deploymentId: { in: $deploymentIds } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            totalAmount
          }
        }
      }

      deploymentBoosterSummaries(filter: { deploymentId: { in: $deploymentIds } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            totalAmount
          }
        }
      }

      eraDeploymentRewards(filter: { deploymentId: { in: $deploymentIds }, eraIdx: { equalTo: $currentIdx } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            allocationRewards
            totalRewards
          }
        }
      }
    }`,
    {
      currentIdx: selectEra,
      deploymentIds: deployments.eraDeploymentRewards.nodes.map(
        (d: { deploymentId: string }) => d.deploymentId
      ),
    }
  );

  return {
    deployments,
    deploymentsInfo,
  };
};

export const getDeploymentCount = async (params: {
  deployment?: string[];
  indexer?: string[];
  start_date: string;
  end_date?: string;
}) => {
  // TODO: make it to .env
  const res = await fetch("https://chs.subquery.network/statistic-queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const json: IGetStatisticQueries = await res.json();

  return json;
};

export interface IGetStatisticQueries {
  total: string;
  list: {
    indexer?: string;
    list?: {
      deployment: string;
      queries: string;
    }[];

    // if no indexer at params
    deployment?: string;
    queries?: string;
  }[];
}
