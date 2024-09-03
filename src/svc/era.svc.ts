import { ContractSDK } from '@subql/contract-sdk';
import fetch from 'cross-fetch';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';
import { APOLLO_FOR_STATS } from '../config';
import gql from 'graphql-tag';
import { BigNumber } from 'ethers';
import { wrapApolloResult } from '@subql/network-clients/dist/utils/apollo';

export class EraSvc {
  private apolloForStats: ApolloClient<unknown>;

  constructor(
      private readonly sdk: ContractSDK,
  ) {
    this.apolloForStats = new ApolloClient({
      cache: new InMemoryCache({ resultCaching: false }),
      link: new HttpLink({ uri: APOLLO_FOR_STATS, fetch: fetch }),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: 'no-cache',
        },
        query: {
          fetchPolicy: 'no-cache',
        },
      },
    });
  }

  async eraFirstBlock(era: number): Promise<number|undefined> {
    const currentEra = await this.sdk.eraManager.eraNumber();
    if (currentEra.lt(era)) {
      return undefined;
    }
    const eraId = BigNumber.from(era).toHexString();

    const res = await wrapApolloResult<{
      era: {
        createdBlock: number;
        startTime: Date;
        endTime?: Date;
      };
    }>(
      this.apolloForStats.query({
        query: gql`
          query ($eraId: String!) {
            era(id: $eraId) {
              createdBlock
            }
          }
        `,
        variables: {
          eraId,
        },
      }),
    );
    if (!res.era) {
      throw new Error(`era not found ${era}`);
    }
    return res.era.createdBlock;
  }

  async eraMostRecentBlock(era: number): Promise<number | undefined> {
    const currentBlocknumber =
      await this.sdk.eraManager.provider.getBlockNumber();
    const nextEraStartBlock = await this.eraFirstBlock(era + 1);
    if (nextEraStartBlock) {
      return nextEraStartBlock - 1;
    } else {
      return currentBlocknumber;
    }
  }
}
