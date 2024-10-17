#!/usr/bin/env -S deno run --allow-env --allow-net --allow-sys --allow-read --allow-write --allow-ffi --allow-run --unstable-worker-options --no-prompt
import { FunctionTool } from "../src/tools/tool.ts";
import {
  formatSQT,
  getAllDeployment,
  getCommission,
  getDeploymentCount,
  getDeploymentInfo,
  getEraInfo,
  getFlexPlanPrice,
  getOperatorDeployment,
} from "./utils.ts";
import { BigNumber as BigNumberJs } from "npm:bignumber.js";
import dayjs from "npm:dayjs";

export class ProjectsRewardsSummary extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  description = `This tool for return projects summaries, give user a guide to select suitable projects to maximize allocation rewards and improve query rewards.
  All the data provided is based on the last era.
  There are five factors that influence allocation rewards:
    1. totalStake
    2. totalBooster
    3. totalAllocationRewards
    4. perSQTRewards
    5. perNewSQTRewards
  There are two factor that influence query rewards:
  1. averageQueryCount.
  2. averageQueryPrice.

  averageQueryPrice * averageQueryCount is the estimated query rewards of the project for one user.

  This tool returns information about the projects the user is currently running and provides recommended project IDs (deploymentId) for optimal allocation.
  `;

  parameters = {
    type: "object",
    required: [],
    properties: {
      type: {
        type: "string",
        description: "The type of project, RPC or indexed datasets or all",
      },
      rewardsType: {
        type: "string",
        description: "The type of rewards, allocation or query or all",
      },
    },
  };

  async call({
    type,
    rewardsType,
  }: {
    type?: string;
    account?: string;
    rewardsType?: "allocation" | "query" | "all";
  }): Promise<string | null> {
    console.warn("call project summary");

    const eraInfo = await getEraInfo(this.endpoint);

    const {
      deployments: allDeployments,
      deploymentsInfo: allDeploymentsInfomations,
    } = await getAllDeployment(this.endpoint, eraInfo.lastEra, {
      sort: "TOTAL_REWARDS_DESC",
    });

    const queries = await getDeploymentCount({
      deployment: allDeployments?.eraDeploymentRewards.nodes.map(
        (i) => i.deploymentId
      ),
      start_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
      end_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
    });

    const result = JSON.stringify(
      allDeployments?.eraDeploymentRewards.nodes
        .map((node) => {
          const eraDeploymentRewardsItem =
            allDeploymentsInfomations?.eraDeploymentRewards.groupedAggregates.find(
              (i) => i.keys[0] === node.deploymentId
            );

          const rawTotalStake = BigNumberJs(
            allDeploymentsInfomations?.indexerAllocationSummaries.groupedAggregates.find(
              (i) => i.keys[0] === node.deploymentId
            )?.sum.totalAmount || "0"
          );

          const totalCount =
            allDeploymentsInfomations?.deployments.nodes.find(
              (i) => i.id === node.deploymentId
            )?.indexers.totalCount || 0;

          const totalAllocation = rawTotalStake.toString();

          const allocationRewards =
            eraDeploymentRewardsItem?.sum.allocationRewards || "0";

          const totalQueryRewards = BigNumberJs(
            eraDeploymentRewardsItem?.sum.totalRewards || "0"
          )
            .minus(eraDeploymentRewardsItem?.sum.allocationRewards || "0")
            .toFixed();
          const deploymentInfo =
            allDeploymentsInfomations?.deployments.nodes.find(
              (i) => i.id === node.deploymentId
            );
          const allocationApy = BigNumberJs(allocationRewards || 0)
            .div(totalAllocation)
            .multipliedBy(52)
            .multipliedBy(100);

          const deploymentQueryCount = queries.list?.find(
            (i) => i.deployment === node.deploymentId
          );

          const averageQueryRewards = BigNumberJs(totalQueryRewards)
            .div(totalCount || 1)
            .toFixed();

          return {
            deploymentId: node.deploymentId,
            projectId: deploymentInfo?.project.id,
            // deploymentLink: `https://app.subquery.network/explorer/project/${deploymentInfo?.project.id}?deploymentId=${deploymentInfo?.project.id}`,
            operatorCount: totalCount,

            // allocation relative
            totalStake: formatSQT(totalAllocation),
            totalAllocationRewards: formatSQT(allocationRewards),
            totalBooster: formatSQT(
              allDeploymentsInfomations?.deploymentBoosterSummaries.groupedAggregates.find(
                (i) => i.keys[0] === node.deploymentId
              )?.sum.totalAmount || "0"
            ),

            queryRewards: formatSQT(totalQueryRewards),
            averageQueryRewards: formatSQT(averageQueryRewards),
            averageQueriesCount: BigNumberJs(
              deploymentQueryCount?.queries || "0"
            )
              .div(totalCount || 1)
              .toString(),
            averageQueryPrice: formatSQT(
              BigNumberJs(totalQueryRewards)
                .div(deploymentQueryCount?.queries || "1")
                .toString()
            ),

            allocationApy: allocationApy.isNaN()
              ? "0.00"
              : allocationApy.gt(1000)
              ? "N/A"
              : allocationApy.toFixed(2),

            totalRewards: formatSQT(
              BigNumberJs(allocationRewards).plus(totalQueryRewards).toString()
            ),
            averageRewards: formatSQT(
              BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || "0")
                .div(totalCount || 1)
                .toFixed()
            ),
          };
        })
        .sort((a, b) => {
          if (rewardsType === "query") {
            return BigNumberJs(b.averageQueryRewards).comparedTo(
              a.averageQueryRewards
            );
          }

          if (rewardsType === "allocation") {
            return BigNumberJs(b.allocationApy).comparedTo(a.allocationApy);
          }

          return BigNumberJs(b.totalRewards).comparedTo(a.totalRewards);
        })
        .slice(0, 5)
    );

    // console.warn(result);

    return result;
  }
}

export class MyProjectSummary extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  description = `This tool returns information about the projects the user is currently running. 
    It can be combined with other tools to provide users with an analysis on how to allocate their resources effectively for optimal allocation rewards.

    Returns the top 5 projects the user is running based on the last era(projects filed).
    This tool returns information about the projects the user is currently running and provides recommended project IDs (deploymentId) for optimal allocation.
  `;

  parameters = {
    type: "object",
    required: ["account"],
    properties: {
      type: {
        type: "string",
        description: "The type of project, RPC or indexed datasets or all",
      },
      account: {
        type: "string",
        description:
          "The account or address of the user which to delegation APY for",
      },
      rewardsType: {
        type: "string",
        description: "The type of rewards, allocation or query or all",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    console.warn("call my project summary");
    const eraInfo = await getEraInfo(this.endpoint);

    if (account && account.startsWith("0x")) {
      const operatorDeployment = await getOperatorDeployment(
        this.endpoint,
        account,
        eraInfo.lastEra
      );

      const {
        deployments: allDeployments,
        deploymentsInfo: allDeploymentsInfomations,
      } = await getAllDeployment(this.endpoint, eraInfo.lastEra, {
        sort: "QUERY_REWARDS_DESC",
      });

      const {
        deployments: allDeploymentsAllocation,
        deploymentsInfo: allDeploymentsInfomationsAllocation,
      } = await getAllDeployment(this.endpoint, eraInfo.lastEra, {
        sort: "ALLOCATION_REWARDS_DESC",
      });

      const queries = await getDeploymentCount({
        deployment: allDeployments?.eraDeploymentRewards.nodes.map(
          (i) => i.deploymentId
        ),
        start_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
        end_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
      });

      const suggestQueryRewardsProjects =
        allDeployments?.eraDeploymentRewards.nodes.map((node) => {
          const eraDeploymentRewardsItem =
            allDeploymentsInfomations?.eraDeploymentRewards.groupedAggregates.find(
              (i) => i.keys[0] === node.deploymentId
            );

          const totalCount =
            allDeploymentsInfomations?.deployments.nodes.find(
              (i) => i.id === node.deploymentId
            )?.indexers.totalCount || 0;

          const totalQueryRewards = BigNumberJs(
            eraDeploymentRewardsItem?.sum.totalRewards || "0"
          )
            .minus(eraDeploymentRewardsItem?.sum.allocationRewards || "0")
            .toFixed();

          const deploymentQueryCount = queries.list?.find(
            (i) => i.deployment === node.deploymentId
          );

          return {
            deploymentId: node.deploymentId,
            totalQueryRewards: formatSQT(totalQueryRewards),
            averageQueryRewards: formatSQT(
              BigNumberJs(totalQueryRewards).div(totalCount).toFixed()
            ),
            totalQueryCount: deploymentQueryCount?.queries || 0,
            averageQueryCount: BigNumberJs(deploymentQueryCount?.queries || "0")
              .div(totalCount || 1)
              .toString(),
          };
        });

      const suggestAllocationRewardsProjects =
        allDeploymentsAllocation?.eraDeploymentRewards.nodes.map((node) => {
          const eraDeploymentRewardsItem =
            allDeploymentsInfomations?.eraDeploymentRewards.groupedAggregates.find(
              (i) => i.keys[0] === node.deploymentId
            );

          const totalCount =
            allDeploymentsInfomations?.deployments.nodes.find(
              (i) => i.id === node.deploymentId
            )?.indexers.totalCount || 0;

          return {
            deploymentId: node.deploymentId,
            totalAllocationRewards: formatSQT(
              eraDeploymentRewardsItem?.sum.allocationRewards || "0"
            ),
            totalAllocation: formatSQT(
              allDeploymentsInfomationsAllocation?.indexerAllocationSummaries.groupedAggregates.find(
                (i) => i.keys[0] === node.deploymentId
              )?.sum.totalAmount || "0"
            ),
            totalBooster: formatSQT(
              allDeploymentsInfomationsAllocation?.deploymentBoosterSummaries.groupedAggregates.find(
                (i) => i.keys[0] === node.deploymentId
              )?.sum.totalAmount || "0"
            ),
            totalStake: formatSQT(
              allDeploymentsInfomationsAllocation?.indexerAllocationSummaries.groupedAggregates.find(
                (i) => i.keys[0] === node.deploymentId
              )?.sum.totalAmount || "0"
            ),
            operatorCount: totalCount,
          };
        });

      return JSON.stringify({
        projects: operatorDeployment.slice(0, 5),
        suggestQueryRewardsProjects: suggestQueryRewardsProjects?.slice(0, 5),
        suggestAllocationRewardsProjects:
          suggestAllocationRewardsProjects?.slice(0, 5),
      });
    }

    return "Please provide a valid account address";
  }
}

export class CommssionSummary extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  description = `This tool returns the average commission rate across all users, 
  the median commission rate, as well as the user's own commission rate and total delegation. 
  Lower commission rates help increase total delegation, with a minimum commission rate of 20%.

  averageCommission: The average commission rate across all users.
  medianCommission: The median commission rate across all users.
  myCommission: The user's own commission rate.
  myTotalDelegation: The user's total delegation.
  `;

  parameters = {
    type: "object",
    required: [],
    properties: {
      account: {
        type: "string",
        description:
          "The account or address of the user which to delegation APY for",
      },
    },
  };

  async call({ account }: { account: string }): Promise<string | null> {
    console.warn("call commission summary");
    const res = await getCommission(this.endpoint, account);

    const commissionVal = res.indexers.nodes.map((i) => {
      const commission =
        parseInt(
          i?.commission?.value?.value ||
            i?.commission?.valueAfter?.value ||
            "200000"
        ) / 10000;

      return commission < 20 ? 20 : commission;
    });

    const averageCommission =
      commissionVal.reduce((a, b) => a + b, 0) / commissionVal.length;

    const medianCommission = commissionVal.sort((a, b) => a - b)[
      Math.floor(commissionVal.length / 2)
    ];

    const myCommission =
      parseInt(
        res.indexer?.commission?.value?.value ||
          res.indexer?.commission?.valueAfter?.value ||
          "200000"
      ) / 10000;

    const myTotalDelegation = formatSQT(
      res?.indexer?.totalStake?.value?.value ||
        res?.indexer?.totalStake?.valueAfter?.value
    );

    return JSON.stringify({
      averageCommission: averageCommission,
      medianCommission: medianCommission,
      myCommission: myCommission,
      myTotalDelegation: myTotalDelegation,
    });
  }
}

export class FlexPlanPrice extends FunctionTool {
  constructor(readonly endpoint: string) {
    super();
  }

  description = `
  This tool is designed to help set prices for a flex plan. 
  If no deploymentId is provided, it will default to recommending a price of 5.
  It returns the average of already set prices and the request volume for each price. 

  details: The details of the price and volume for each price.
  averagePrice: The average price of the flex plan.
  `;

  parameters = {
    type: "object",
    required: [],
    properties: {
      deploymentId: {
        type: "string",
        description: "The id of the deployment to get the flex plan price for",
      },
    },
  };

  async call({
    deploymentId,
  }: {
    deploymentId: string;
  }): Promise<string | null> {
    console.warn("call flex plan price");
    if (!deploymentId.startsWith("Qm"))
      return '{ averagePrice: 5, details: [{ "price": 5, }] }';
    // const deploymentInfo = await getDeploymentInfo(this.endpoint, deploymentId);
    const eraInfo = await getEraInfo(this.endpoint);

    const res = await getFlexPlanPrice({
      deployment: [deploymentId],
      start_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
      end_date: dayjs(eraInfo.eras.at(1)?.startTime).format("YYYY-MM-DD"),
    });

    const details = res.map((i) => {
      return {
        price: BigNumberJs(formatSQT(i.price || "0"))
          .multipliedBy(1000)
          .toString(),
        volumn: Math.floor(i.count || 0),
      };
    });

    return JSON.stringify({
      details,
      averagePrice: details
        .reduce((a, b) => BigNumberJs(a).plus(b.price), BigNumberJs(0))
        .div(details.length)
        .toString(),
    });
  }
}
