#!/usr/bin/env -S deno run --allow-env --allow-net --allow-sys --allow-read --allow-write --allow-ffi --allow-run --unstable-worker-options --no-prompt
import { FunctionTool } from "../src/tool.ts";
import {
  formatSQT,
  getAllDeployment,
  getDeploymentCount,
  getEraInfo,
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
  `;

  parameters = {
    type: "object",
    required: [],
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

  async call({
    type,
    account,
    rewardsType,
  }: {
    type?: string;
    account?: string;
    rewardsType?: "allocation" | "query" | "all";
  }): Promise<string | null> {
    const eraInfo = await getEraInfo(this.endpoint);

    // if (account && account.startsWith("0x")) {
    //   const operatorDeployment = await getOperatorDeployment(
    //     this.endpoint,
    //     account,
    //     eraInfo.lastEra
    //   );
    //   if (operatorDeployment.length >= 5) {
    //     return JSON.stringify(operatorDeployment.slice(0, 5));
    //   }
    // }

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
      start_date: dayjs(eraInfo.eras.at(-2)?.startTime).format("YYYY-MM-DD"),
      end_date: dayjs(eraInfo.eras.at(-2)?.startTime).format("YYYY-MM-DD"),
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

    console.warn(result);

    return result;
  }
}
