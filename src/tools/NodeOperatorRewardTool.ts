import {FunctionTool} from "./base";
import {NodeOperatorSvc} from "../svc/nodeOperator.svc";
import {ContractSvc} from "../svc/contract.svc";

export class NodeOperatorRewardTool extends FunctionTool {
    name = "NodeOperatorReward";

    description = `This tool queries a given Node Operator's reward of last era.
    It returns total rewards node operator got as a whole (including its delegators' reward), his own rewards and his delegators' rewards.
    It also returns the commission rate of the node operator, which combined can demonstrate a overview of rewards distribution.
    `;

    parameters = {
        type: 'object',
        required: ['wallet'],
        properties: {
            wallet: {
                type: 'string',
                description: 'node operator wallet address',
            },
        }
    };

    constructor(private readonly svc: NodeOperatorSvc, private readonly contractSvc: ContractSvc) {
        super();
    }

    async call({wallet} : {wallet: string}) {
        try {
            if (!wallet || !wallet.startsWith('0x')) {
                return `error: wallet is missing`;
            }
            const currentEra = await this.contractSvc.currentEra();
            const lastEra = currentEra.toNumber() - 1;
            const [distributedRewards, selfStake, totalStake, commission, stakeWeight] = await Promise.all([
                this.svc.findEraDistributedRewards(lastEra, wallet),
                this.svc.getOperatorSelfStake(lastEra, wallet),
                this.svc.getOperatorTotalStake(lastEra, wallet),
                this.svc.getOperatorCommissionRate(lastEra, wallet),
                this.svc.getOperatorStakeWeight(lastEra),
            ]);
            const calculatedOperatorStake = selfStake * stakeWeight;
            const calculatedTotalStake =
                totalStake - selfStake + calculatedOperatorStake;
            const sharedRewards = distributedRewards - commission;
            const selfRewards = sharedRewards *
                (calculatedOperatorStake / calculatedTotalStake) + commission;


            return `${JSON.stringify({
                era: lastEra,
                totalRewards: distributedRewards,
                selfRewards,
                delegatorRewards: distributedRewards - selfRewards,
                selfStake,
                totalStake,
            })
            }`;
        } catch (error) {
            console.log('ERROR running query', error)
            return `${error}`;
        }
    }
}