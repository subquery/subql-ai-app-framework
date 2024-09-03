import {ContractSDK} from "@subql/contract-sdk";
import {BigNumber} from "ethers";
import {n} from "ollama/dist/shared/ollama.1164e541";

export class ContractSvc{
    constructor(
        private readonly sdk: ContractSDK,
    ) {}

    async currentEra(): Promise<BigNumber> {
        return this.sdk.eraManager.eraNumber();
    }

    async walletBalance(wallet: string): Promise<BigNumber> {
        return this.sdk.sqToken.balanceOf(wallet);
    }

    async totalStake(wallet: string, era?: number): Promise<BigNumber> {
        const [currentEra,stakeAmount] = await Promise.all([
            this.currentEra(),
            this.sdk.staking.totalStakingAmount(wallet)
        ]);
        if (era === undefined || stakeAmount.era.lt(era)){
            return stakeAmount.valueAfter;
        } else if (currentEra.eq(era)){
            return stakeAmount.valueAt;
        } else {
            throw new Error('Historical era data not available');
            // TODO: use historical data
        }
    }
}