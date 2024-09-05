import {FunctionTool} from "./base";
import {NodeOperatorSvc} from "../svc/nodeOperator.svc";
import {ContractSvc} from "../svc/contract.svc";

export class NodeOperatorProjectRewardTool extends FunctionTool {
    name = "NodeOperatorProjectReward";

    description = `This tool queries a given Node Operator's reward from each deployment he has been running of last era.
    It returns the average allocation SQT on each projects and their APY, which can be further used to analysis ROI of running
    these projects and give suggestions.
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



            return `${JSON.stringify({
            })
            }`;
        } catch (error) {
            console.log('ERROR running query', error)
            return `${error}`;
        }
    }
}