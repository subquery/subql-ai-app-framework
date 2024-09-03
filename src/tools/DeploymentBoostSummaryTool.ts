import {take, sortBy} from 'lodash';
import {FunctionTool} from "./base";
import {NodeOperatorSvc} from "../svc/nodeOperator.svc";

/**
 * due to context size limit, only return top 10
 */
export class DeploymentBoostSummaryTool extends FunctionTool {
    name = "DeploymentBoostSummary";

    description = `This tool queries all deployments published on SubQuery Network, return top 10 deployments order by boost SQT. It returns aggregated Boosted SQT on the deployment for given era.
    Total boost SQT decides how large reward a deployment can get from the network, can be used to analysis project rewards. The higher allocation the more competitive the project is. 
    Efficiency is \`boost / allocation\`, the higher the better.
    If era is not provided, do not set default value.
    `;

    parameters = {
        type: 'object',
        required: [],
        properties: {
            era: {
                type: 'number',
                description: 'optional, when not given, it will use current era, don\'t try to put default value',
            },
        }
    };

    constructor(private readonly svc: NodeOperatorSvc) {
        super();
    }

    async call({ era } : { era: number}) {
        try {
            const [boosts, allocations] = await Promise.all([
                this.svc.findEraDeploymentBoostersAggregated(era),
                this.svc.findCurrentDeploymentAllocation(),
            ]);
            const processed = boosts.map(b => {
                const allocation = allocations[b.deploymentId];
                const efficiency = allocation === undefined ? Number.POSITIVE_INFINITY : b.amount / allocation;

                return {
                    deploymentId: b.deploymentId,
                    boost: b.amount,
                    allocation,
                    efficiency,
                }
            })

            return `${JSON.stringify({
                orderByEfficiency: take(sortBy(processed, (a)=>-a.efficiency), 10),
                orderByBoost: take(sortBy(processed, (a)=>-a.boost), 10),
            })
            }`;
        } catch (error) {
            console.log('ERROR running query', error)
            return `${error}`;
        }
    }
}