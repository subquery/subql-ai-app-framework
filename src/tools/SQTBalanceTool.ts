import {FunctionTool} from "./base";
import {NodeOperatorSvc} from "../svc/nodeOperator.svc";
import {ContractSvc} from "../svc/contract.svc";
import {utils} from "ethers";

export class SQTBalanceTool extends FunctionTool {
    name = "SQTBalance";

    description = `This tool queries different contracts for given wallet's SQT balance.
A wallet is an ethereum compatible wallet starting from 0x, read from user's input and ask when it is missing.`;

    parameters = {
        type: 'object',
        required: ['wallet'],
        properties: {
            wallet: {
                type: 'string',
                description: 'ethereum compatible wallet required for the query',
            },
        }
    };

    constructor(private readonly svc: NodeOperatorSvc, private readonly contractSvc: ContractSvc) {
        super();
    }

    async call({ wallet } : { wallet: string}) {
        try {
            // const res =  await grahqlRequest(this.endpoint, `query { ${entity} { totalCount } }`);
            if (!wallet || !wallet.startsWith('0x')) {
                return `error: wallet is missing`;
            }
            const [walletBalance, stakedBalance, totalBoostedBalance] = await Promise.all([
                this.contractSvc.walletBalance(wallet),
                this.contractSvc.totalStake(wallet),
                this.svc.findCurrentConsumerTotalBoost(wallet),
            ]);
            const res = {walletBalance: Number(utils.formatEther(walletBalance)), stakedBalance: Number(utils.formatEther(stakedBalance)), totalBoostedBalance};
            return `Have ${res.walletBalance} SQT in wallet, ${res.stakedBalance} SQT staked and ${res.totalBoostedBalance} SQT boosted to deployments`;
        } catch (error) {
            console.log('ERROR running query', error)
            return `${error}`;
        }
    }
}