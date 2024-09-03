import {ContractSDK} from '@subql/contract-sdk';
import fetch from 'cross-fetch';
import {utils} from 'ethers';
import BigNumber from 'bignumber.js';
import {uniqBy} from 'lodash';

import {ApolloClient, HttpLink, InMemoryCache} from '@apollo/client/core';
import {APOLLO_FOR_MAIN, APOLLO_FOR_STATS} from '../config';
import gql from 'graphql-tag';
import {wrapApolloResult} from '@subql/network-clients/dist/utils/apollo';
import {EraSvc} from './era.svc';
import {cidToBytes32} from '@subql/network-clients';
import {logger} from '../logger';

type GqlEraValue = {
    era: number;
    value: {
        type: string;
        value: string;
    };
    valueAfter: {
        type: string;
        value: string;
    };
};

export class NodeOperatorSvc {
    private apolloForStats: ApolloClient<unknown>;
    private apolloForMain: ApolloClient<unknown>;

    constructor(
        private readonly sdk: ContractSDK,
        private readonly eraSvc: EraSvc
    ) {
        // const provider = new providers.StaticJsonRpcProvider(argv.rpcEndpoint);
        // this.sdk = ContractSDK.create(provider, {network: 'mainnet'});
        this.apolloForStats = new ApolloClient({
            cache: new InMemoryCache({resultCaching: false}),
            link: new HttpLink({uri: APOLLO_FOR_STATS, fetch: fetch}),
            defaultOptions: {
                watchQuery: {
                    fetchPolicy: 'no-cache',
                },
                query: {
                    fetchPolicy: 'no-cache',
                },
            },
        });
        this.apolloForMain = new ApolloClient({
            cache: new InMemoryCache({resultCaching: false}),
            link: new HttpLink({uri: APOLLO_FOR_MAIN, fetch: fetch}),
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

    async findAllOperators(era: number) {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const res = await wrapApolloResult<{
            indexers: {
                nodes: { id: string }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!) {
                        indexers(
                            blockHeight: $height
                            filter: { active: { equalTo: true } }
                        ) {
                            nodes {
                                id
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                },
            }),
        );
        return (res?.indexers?.nodes ?? []).map((n) => n.id);
    }

    async getOperatorCommissionRate(era: number, operator: string) {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const commissionRate = await this.sdk.indexerRegistry.getCommissionRate(
            operator,
            {blockTag: eraBlock},
        );
        return commissionRate.toNumber() / 1e6;
    }

    async getOperatorStakeWeight(era: number) {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        try {
            const stakeWeight = await this.sdk.rewardsStaking.runnerStakeWeight({
                blockTag: eraBlock,
            });
            return stakeWeight.toNumber() / 1e6;
        } catch (e: any) {
            if (e.message.includes('missing revert data')) {
                return 1;
            } else {
                throw e;
            }
        }
    }

    // formatted ether
    async getOperatorTotalStake(era: number, operator: string) {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        try {
            const totalStake = await this.sdk.staking.totalStakingAmount(operator, {
                blockTag: eraBlock,
            });
            if (totalStake && totalStake.era.gt(0)) {
                return era > totalStake.era.toNumber()
                    ? Number(utils.formatEther(totalStake.valueAfter))
                    : Number(utils.formatEther(totalStake.valueAt));
            }
        } catch (e: any) {
            logger.error(
                `can not find total stake for ${operator} at era ${era}`,
                e.stack,
            );
            throw e;
        }
        return undefined;
    }

    // formatted ether
    async getOperatorSelfStake(era: number, operator: string) {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        try {
            const selfStake = await this.sdk.staking.delegation(operator, operator, {
                blockTag: eraBlock,
            });
            if (selfStake && selfStake.era.gt(0)) {
                return era > selfStake.era.toNumber()
                    ? Number(utils.formatEther(selfStake.valueAfter))
                    : Number(utils.formatEther(selfStake.valueAt));
            }
        } catch (e: any) {
            logger.error(
                `can not find total stake for ${operator} at era ${era}`,
                e.stack,
            );
        }
        return undefined;
    }

    // todo: find new delegators (delegate in current era)
    async findAllDelegation(
        era: number,
        operator: string,
    ): Promise<{ delegator: string; amount: number }[]> {
        const eraBlock = await this.eraSvc.eraFirstBlock(era);
        const res = await wrapApolloResult<{
            delegations: {
                totalCount: number;
                edges: {
                    cursor: string;
                    node: { delegatorId: string; amount: GqlEraValue };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!, $indexer: String!) {
                        delegations(
                            blockHeight: $height
                            first: 100
                            filter: {
                                indexerId: { equalTo: $indexer }
                                delegatorId: { notEqualTo: $indexer }
                            }
                        ) {
                            totalCount
                            edges {
                                cursor
                                node {
                                    delegatorId
                                    amount
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                    indexer: operator,
                },
            }),
        );
        const edges: {
            cursor: string;
            node: { delegatorId: string; amount: GqlEraValue };
        }[] = res.delegations.edges;
        if (res.delegations.totalCount > 100) {
            for (
                let i = 0;
                i < Math.ceil(res.delegations.totalCount / 100 - 1);
                i++
            ) {
                const cursor = edges[edges.length - 1].cursor;
                const r2 = await wrapApolloResult<{
                    delegations: {
                        edges: {
                            cursor: string;
                            node: { delegatorId: string; amount: GqlEraValue };
                        }[];
                    };
                }>(
                    this.apolloForMain.query({
                        query: gql`
                            query ($height: String!, $indexer: String!, $cursor: Cursor!) {
                                delegations(
                                    blockHeight: $height
                                    first: 100
                                    filter: {
                                        indexerId: { equalTo: $indexer }
                                        delegatorId: { notEqualTo: $indexer }
                                    }
                                    after: $cursor
                                ) {
                                    edges {
                                        cursor
                                        node {
                                            delegatorId
                                            amount
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            height: String(eraBlock),
                            indexer: operator,
                            cursor,
                        },
                    }),
                );
                edges.push(...r2.delegations.edges);
            }
        }

        return edges
            .map(({node}) => {
                const amount =
                    era > node.amount.era
                        ? Number(
                            utils.formatEther(
                                BigNumber(node.amount.valueAfter.value).toFixed(),
                            ),
                        )
                        : Number(
                            utils.formatEther(BigNumber(node.amount.value.value).toFixed()),
                        );
                return {delegator: node.delegatorId, amount};
            })
            .reduce(
                // remove zero delegation
                (acc, node) => {
                    if (node.amount > 0) {
                        acc.push(node);
                    }
                    return acc;
                },
                [] as { delegator: string; amount: number }[],
            );
    }

    async findEraCommission(era: number, operator: string) {
        const res = await wrapApolloResult<{
            distributedCommissions: {
                nodes: { indexer: string; amount: string }[];
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($era: Int!, $operator: String!) {
                        distributedCommissions(
                            filter: {
                                eraId: { equalTo: $era }
                                indexer: { equalTo: $operator }
                            }
                        ) {
                            nodes {
                                amount
                            }
                        }
                    }
                `,
                variables: {
                    era: era,
                    operator,
                },
            }),
        );
        const amount = res.distributedCommissions.nodes?.[0]?.amount;
        if (amount) {
            return Number(utils.formatEther(BigNumber(amount).toFixed()));
        }
        return undefined;
    }

    async findEraDistributedRewards(era: number, operator: string) {
        const res = await wrapApolloResult<{
            distributedRewards: {
                nodes: { indexer: string; amount: string }[];
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($era: Int!, $operator: String!) {
                        distributedRewards(
                            filter: {
                                eraId: { equalTo: $era }
                                indexer: { equalTo: $operator }
                            }
                        ) {
                            nodes {
                                amount
                            }
                        }
                    }
                `,
                variables: {
                    era: era,
                    operator,
                },
            }),
        );
        const amount = res.distributedRewards.nodes?.[0]?.amount;
        if (amount) {
            return Number(utils.formatEther(BigNumber(amount).toFixed()));
        }
        return undefined;
    }


    async findEraDeployments(
        era: number,
    ): Promise<{ operator: string; deploymentId: string }[]> {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const res = await wrapApolloResult<{
            indexerDeployments: {
                totalCount: number;
                edges: {
                    cursor: string;
                    node: {
                        indexerId: string;
                        deploymentId: string;
                    };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!) {
                        indexerDeployments(
                            blockHeight: $height
                            first: 100
                            filter: { status: { equalTo: READY } }
                        ) {
                            totalCount
                            edges {
                                cursor
                                node {
                                    indexerId
                                    deploymentId
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                },
            }),
        );

        const edges: {
            cursor: string;
            node: { indexerId: string; deploymentId: string };
        }[] = res.indexerDeployments.edges;
        if (res.indexerDeployments.totalCount > 100) {
            for (
                let i = 0;
                i < Math.ceil(res.indexerDeployments.totalCount / 100 - 1);
                i++
            ) {
                const cursor = edges[edges.length - 1].cursor;
                const r2 = await wrapApolloResult<{
                    indexerDeployments: {
                        edges: {
                            cursor: string;
                            node: {
                                indexerId: string;
                                deploymentId: string;
                            };
                        }[];
                    };
                }>(
                    this.apolloForMain.query({
                        query: gql`
                            query ($height: String!, $cursor: Cursor!) {
                                indexerDeployments(
                                    blockHeight: $height
                                    first: 100
                                    filter: { status: { equalTo: READY } }
                                    after: $cursor
                                ) {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            indexerId
                                            deploymentId
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            height: String(eraBlock),
                            cursor,
                        },
                    }),
                );
                edges.push(...r2.indexerDeployments.edges);
            }
        }
        return uniqBy(
            edges.map((edge) => ({
                operator: edge.node.indexerId,
                deploymentId: edge.node.deploymentId,
            })),
            (edge) => edge.deploymentId + edge.operator,
        );
    }

    async findEraDeploymentsV2(
        era: number,
    ): Promise<{ operator: string; deploymentId: string; allocation: number }[]> {
        const res = await wrapApolloResult<{
            eraIndexerDeploymentApies: {
                totalCount: number;
                edges: {
                    cursor: string;
                    node: {
                        indexerId: string;
                        deploymentId: string;
                        apyCalcAllocation: string;
                    };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($eraIdx: Int!) {
                        eraIndexerDeploymentApies(
                            first: 100
                            filter: { eraIdx: { equalTo: $eraIdx } }
                        ) {
                            totalCount
                            edges {
                                cursor
                                node {
                                    indexerId
                                    deploymentId
                                    apyCalcAllocation
                                }
                            }
                        }
                    }
                `,
                variables: {
                    eraIdx: era,
                },
            }),
        );

        const edges: {
            cursor: string;
            node: {
                indexerId: string;
                deploymentId: string;
                apyCalcAllocation: string;
            };
        }[] = res.eraIndexerDeploymentApies.edges;
        if (res.eraIndexerDeploymentApies.totalCount > 100) {
            for (
                let i = 0;
                i < Math.ceil(res.eraIndexerDeploymentApies.totalCount / 100 - 1);
                i++
            ) {
                const cursor = edges[edges.length - 1].cursor;
                const r2 = await wrapApolloResult<{
                    eraIndexerDeploymentApies: {
                        edges: {
                            cursor: string;
                            node: {
                                indexerId: string;
                                deploymentId: string;
                                apyCalcAllocation: string;
                            };
                        }[];
                    };
                }>(
                    this.apolloForMain.query({
                        query: gql`
                            query ($eraIdx: Int!, $cursor: Cursor!) {
                                eraIndexerDeploymentApies(
                                    first: 100
                                    filter: { eraIdx: { equalTo: $eraIdx } }
                                    after: $cursor
                                ) {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            indexerId
                                            deploymentId
                                            apyCalcAllocation
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            eraIdx: era,
                            cursor,
                        },
                    }),
                );
                edges.push(...r2.eraIndexerDeploymentApies.edges);
            }
        }
        return uniqBy(
            edges.map((edge) => ({
                operator: edge.node.indexerId,
                deploymentId: edge.node.deploymentId,
                allocation: Number(utils.formatEther(edge.node.apyCalcAllocation)),
            })),
            (edge) => edge.deploymentId + edge.operator,
        );
    }

    async findEraDeploymentAllocationReward(
        era: number,
        operator: string,
        deployment: string,
    ) {
        const res = await wrapApolloResult<{
            indexerAllocationRewards: {
                aggregates: { sum: { reward: string; burnt: string } };
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($era: Int!, $operator: String!, $deployment: String!) {
                        indexerAllocationRewards(
                            filter: {
                                eraId: { equalTo: $era }
                                indexer: { equalTo: $operator }
                                deploymentId: { equalTo: $deployment }
                            }
                        ) {
                            aggregates {
                                sum {
                                    reward
                                    burnt
                                }
                            }
                        }
                    }
                `,
                variables: {
                    era,
                    operator,
                    deployment,
                },
            }),
        );
        return {
            reward: Number(
                utils.formatEther(
                    BigNumber(
                        res.indexerAllocationRewards.aggregates.sum.reward,
                    ).toFixed(),
                ),
            ),
            burnt: Number(
                utils.formatEther(
                    BigNumber(
                        res.indexerAllocationRewards.aggregates.sum.burnt,
                    ).toFixed(),
                ),
            ),
        };
    }

    async findEraOperatorArrivalReward(era: number, operator: string) {
        const res = await wrapApolloResult<{
            indexerEraRewardsArrivals: {
                aggregates: { sum: { reward: string } };
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($era: Int!, $operator: String!) {
                        indexerEraRewardsArrivals(
                            filter: {
                                indexer: { equalTo: $operator }
                                eraId: { equalTo: $era }
                            }
                        ) {
                            aggregates {
                                sum {
                                    reward
                                }
                            }
                        }
                    }
                `,
                variables: {
                    era,
                    operator,
                },
            }),
        );
        return {
            reward: Number(
                utils.formatEther(
                    BigNumber(
                        res.indexerEraRewardsArrivals.aggregates.sum.reward,
                    ).toFixed(),
                ),
            ),
        };
    }

    async findEraOperatorDeploymentUnclaimedAllocationReward(
        era: number,
        operator: string,
        deployment: string,
    ) {
        const blockNumber = await this.eraSvc.eraMostRecentBlock(era);
        const [reward, burnt] = await this.sdk.rewardsBooster.getAllocationRewards(
            cidToBytes32(deployment),
            operator,
            {
                blockTag: blockNumber,
            },
        );
        return {
            reward: Number(utils.formatEther(reward)),
            burnt: Number(utils.formatEther(burnt)),
        };
    }

    async findEraDeploymentBoosters(
        era: number,
    ): Promise<{ consumer: string; deploymentId: string; amount: number }[]> {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const res = await wrapApolloResult<{
            deploymentBoosterSummaries: {
                totalCount: number;
                edges: {
                    cursor: string;
                    node: {
                        consumer: string;
                        deploymentId: string;
                        totalAmount: string;
                    };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!) {
                        deploymentBoosterSummaries(
                            blockHeight: $height
                            filter: { totalAmount: { greaterThan: "0" } }
                            orderBy: [TOTAL_AMOUNT_DESC]
                            first: 100
                        ) {
                            totalCount
                            edges {
                                cursor
                                node {
                                    consumer
                                    deploymentId
                                    totalAmount
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                },
            }),
        );

        const edges: {
            cursor: string;
            node: { consumer: string; deploymentId: string; totalAmount: string };
        }[] = res.deploymentBoosterSummaries.edges;
        if (res.deploymentBoosterSummaries.totalCount > 100) {
            for (
                let i = 0;
                i < Math.ceil(res.deploymentBoosterSummaries.totalCount / 100 - 1);
                i++
            ) {
                const cursor = edges[edges.length - 1].cursor;
                const r2 = await wrapApolloResult<{
                    deploymentBoosterSummaries: {
                        edges: {
                            cursor: string;
                            node: {
                                consumer: string;
                                deploymentId: string;
                                totalAmount: string;
                            };
                        }[];
                    };
                }>(
                    this.apolloForMain.query({
                        query: gql`
                            query ($height: String!, $cursor: Cursor!) {
                                deploymentBoosterSummaries(
                                    blockHeight: $height
                                    first: 100
                                    filter: { totalAmount: { greaterThan: "0" } }
                                    after: $cursor
                                ) {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            consumer
                                            deploymentId
                                            totalAmount
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            height: String(eraBlock),
                            cursor,
                        },
                    }),
                );
                edges.push(...r2.deploymentBoosterSummaries.edges);
            }
        }
        return edges.map((edge) => ({
            consumer: edge.node.consumer,
            deploymentId: edge.node.deploymentId,
            amount: Number(
                utils.formatEther(BigNumber(edge.node.totalAmount).toFixed()),
            ),
        }));
    }

    async findEraDeploymentBoostersAggregated(
        _era?: number,
    ): Promise<{ deploymentId: string; amount: number }[]> {
        let era = _era;
        if (era === undefined || era === null || typeof era !== 'number') {
            era = (await this.sdk.eraManager.eraNumber()).toNumber();
        }
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const res = await wrapApolloResult<{
            deploymentBoosterSummaries: {
                totalCount: number;
                groupedAggregates: {
                    keys: string[];
                    sum: {
                        totalAmount: string;
                    };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!) {
                        deploymentBoosterSummaries(
                            blockHeight: $height
                            filter: { totalAmount: { greaterThan: "0" } }
                        ) {
                            groupedAggregates(groupBy:[DEPLOYMENT_ID]){
                                keys
                                sum{
                                    totalAmount
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                },
            }),
        );

        return res.deploymentBoosterSummaries.groupedAggregates.map((aggr) => ({
            deploymentId: aggr.keys[0],
            amount: Number(
                utils.formatEther(BigNumber(aggr.sum.totalAmount).toFixed()),
            ),
        }));
    }

    // async findEraStateChannels(era: number): Promise<
    //     {
    //         channelId: string;
    //         consumer: string;
    //         deploymentId: string;
    //         nodeOperator: string;
    //         spent: number;
    //         price: number;
    //     }[]
    // > {
    //     const ongoingChannels: any = await this.findEraStateChannels1(era);
    //     const ongoingChannelSpents = await this.findEraStateChannels4(
    //         era,
    //         ongoingChannels,
    //     );
    //     // copy ongoingChannels in a new var set spent base on what's in ongoingChannelSpents
    //
    //     ongoingChannels.forEach((channel) => {
    //         const spent = ongoingChannelSpents.find(
    //             (c) => c.channelId === channel.channelId,
    //         )?.spent;
    //         if (spent !== undefined) {
    //             (channel as any).spent = spent;
    //         }
    //     });
    //     const newChannels = await this.findEraStateChannels2(era);
    //     // dedupe newChannels by channel id
    //     newChannels.forEach((newChannel) => {
    //         if (
    //             !ongoingChannels.find(
    //                 (channel) => channel.channelId === newChannel.channelId,
    //             )
    //         ) {
    //             ongoingChannels.push(newChannel);
    //         }
    //     });
    //     return ongoingChannels;
    // }
    //
    // private async findEraStateChannels1(era: number): Promise<
    //     {
    //         channelId: string;
    //         consumer: string;
    //         nodeOperator: string;
    //         deploymentId: string;
    //         startSpent: number;
    //         price: number;
    //     }[]
    // > {
    //     const eraStartBlock = await this.eraSvc.eraFirstBlock(era);
    //     const res = await wrapApolloResult<{
    //         stateChannels: {
    //             totalCount: number;
    //             edges: {
    //                 cursor: string;
    //                 node: {
    //                     id: string;
    //                     indexer: string;
    //                     consumer: string;
    //                     deploymentId: string;
    //                     spent: string;
    //                     price: string;
    //                 };
    //             }[];
    //         };
    //     }>(
    //         this.apolloForMain.query({
    //             query: gql`
    //                 query ($height: String!) {
    //                     stateChannels(
    //                         blockHeight: $height
    //                         filter: { status: { equalTo: OPEN } }
    //                         first: 100
    //                     ) {
    //                         totalCount
    //                         edges {
    //                             cursor
    //                             node {
    //                                 id
    //                                 deploymentId
    //                                 indexer
    //                                 consumer
    //                                 spent
    //                                 price
    //                             }
    //                         }
    //                     }
    //                 }
    //             `,
    //             variables: {
    //                 height: String(eraStartBlock),
    //             },
    //         }),
    //     );
    //
    //     const edges: {
    //         cursor: string;
    //         node: {
    //             id: string;
    //             indexer: string;
    //             consumer: string;
    //             deploymentId: string;
    //             spent: string;
    //             price: string;
    //         };
    //     }[] = res.stateChannels.edges;
    //     if (res.stateChannels.totalCount > 100) {
    //         for (
    //             let i = 0;
    //             i < Math.ceil(res.stateChannels.totalCount / 100 - 1);
    //             i++
    //         ) {
    //             const cursor = edges[edges.length - 1].cursor;
    //             const r2 = await wrapApolloResult<{
    //                 stateChannels: {
    //                     edges: {
    //                         cursor: string;
    //                         node: {
    //                             id: string;
    //                             indexer: string;
    //                             consumer: string;
    //                             deploymentId: string;
    //                             spent: string;
    //                             price: string;
    //                         };
    //                     }[];
    //                 };
    //             }>(
    //                 this.apolloForMain.query({
    //                     query: gql`
    //                         query ($height: String!, $cursor: Cursor!) {
    //                             stateChannels(
    //                                 blockHeight: $height
    //                                 first: 100
    //                                 filter: { status: { equalTo: OPEN } }
    //                                 after: $cursor
    //                             ) {
    //                                 totalCount
    //                                 edges {
    //                                     cursor
    //                                     node {
    //                                         id
    //                                         deploymentId
    //                                         indexer
    //                                         consumer
    //                                         spent
    //                                         price
    //                                     }
    //                                 }
    //                             }
    //                         }
    //                     `,
    //                     variables: {
    //                         height: String(eraStartBlock),
    //                         cursor,
    //                     },
    //                 }),
    //             );
    //             edges.push(...r2.stateChannels.edges);
    //         }
    //     }
    //     return edges.map((edge) => ({
    //         consumer: edge.node.consumer,
    //         deploymentId: edge.node.deploymentId,
    //         channelId: edge.node.id,
    //         nodeOperator: edge.node.indexer,
    //         startSpent: Number(
    //             utils.formatEther(BigNumber(edge.node.spent).toFixed()),
    //         ),
    //         price: Number(utils.formatEther(BigNumber(edge.node.price).toFixed())),
    //     }));
    // }

    // private async findEraStateChannels2(era: number): Promise<
    //     {
    //         channelId: string;
    //         consumer: string;
    //         nodeOperator: string;
    //         deploymentId: string;
    //         spent: number;
    //         price: number;
    //     }[]
    // > {
    //     const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
    //     const {startAt} = await this.eraSvc.getEra(era);
    //
    //     const res = await wrapApolloResult<{
    //         stateChannels: {
    //             totalCount: number;
    //             edges: {
    //                 cursor: string;
    //                 node: {
    //                     id: string;
    //                     indexer: string;
    //                     consumer: string;
    //                     deploymentId: string;
    //                     spent: string;
    //                     price: string;
    //                 };
    //             }[];
    //         };
    //     }>(
    //         this.apolloForMain.query({
    //             query: gql`
    //                 query ($height: String!, $startAt: Datetime!) {
    //                     stateChannels(
    //                         blockHeight: $height
    //                         filter: {
    //                             spent: { greaterThan: "0" }
    //                             startTime: { greaterThanOrEqualTo: $startAt }
    //                         }
    //                         first: 100
    //                     ) {
    //                         totalCount
    //                         edges {
    //                             cursor
    //                             node {
    //                                 id
    //                                 deploymentId
    //                                 indexer
    //                                 consumer
    //                                 spent
    //                                 price
    //                             }
    //                         }
    //                     }
    //                 }
    //             `,
    //             variables: {
    //                 height: String(eraBlock),
    //                 startAt,
    //             },
    //         }),
    //     );
    //
    //     const edges: {
    //         cursor: string;
    //         node: {
    //             id: string;
    //             indexer: string;
    //             consumer: string;
    //             deploymentId: string;
    //             spent: string;
    //             price: string;
    //         };
    //     }[] = res.stateChannels.edges;
    //     if (res.stateChannels.totalCount > 100) {
    //         for (
    //             let i = 0;
    //             i < Math.ceil(res.stateChannels.totalCount / 100 - 1);
    //             i++
    //         ) {
    //             const cursor = edges[edges.length - 1].cursor;
    //             const r2 = await wrapApolloResult<{
    //                 stateChannels: {
    //                     edges: {
    //                         cursor: string;
    //                         node: {
    //                             id: string;
    //                             indexer: string;
    //                             consumer: string;
    //                             deploymentId: string;
    //                             spent: string;
    //                             price: string;
    //                         };
    //                     }[];
    //                 };
    //             }>(
    //                 this.apolloForMain.query({
    //                     query: gql`
    //                         query ($height: String!, $startAt: Datetime!, $cursor: Cursor!) {
    //                             stateChannels(
    //                                 blockHeight: $height
    //                                 first: 100
    //                                 filter: {
    //                                     spent: { greaterThan: "0" }
    //                                     startTime: { greaterThanOrEqualTo: $startAt }
    //                                 }
    //                                 after: $cursor
    //                             ) {
    //                                 totalCount
    //                                 edges {
    //                                     cursor
    //                                     node {
    //                                         id
    //                                         deploymentId
    //                                         indexer
    //                                         consumer
    //                                         spent
    //                                         price
    //                                     }
    //                                 }
    //                             }
    //                         }
    //                     `,
    //                     variables: {
    //                         height: String(eraBlock),
    //                         startAt,
    //                         cursor,
    //                     },
    //                 }),
    //             );
    //             edges.push(...r2.stateChannels.edges);
    //         }
    //     }
    //     return edges.map((edge) => ({
    //         consumer: edge.node.consumer,
    //         deploymentId: edge.node.deploymentId,
    //         channelId: edge.node.id,
    //         nodeOperator: edge.node.indexer,
    //         spent: Number(utils.formatEther(BigNumber(edge.node.spent).toFixed())),
    //         price: Number(utils.formatEther(BigNumber(edge.node.price).toFixed())),
    //     }));
    // }

    // private async findEraStateChannels3(
    //     era: number,
    //     channelId: string,
    //     startSpent: number,
    // ): Promise<number> {
    //     const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
    //     const res = await wrapApolloResult<{
    //         stateChannel?: {
    //             spent: string;
    //         };
    //     }>(
    //         this.apolloForMain.query({
    //             query: gql`
    //                 query ($height: String!, $channelId: String!) {
    //                     stateChannel(id: $channelId, blockHeight: $height) {
    //                         spent
    //                     }
    //                 }
    //             `,
    //             variables: {
    //                 height: String(eraBlock),
    //                 channelId,
    //             },
    //         }),
    //     );
    //
    //     return (
    //         Number(utils.formatEther(BigNumber(res.stateChannel.spent).toFixed())) -
    //         startSpent
    //     );
    // }
    //
    // private async findEraStateChannels4(
    //     era: number,
    //     channels: { channelId: string; startSpent: number }[],
    // ): Promise<{ channelId: string; spent: number }[]> {
    //     const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
    //     const channelIds = channels.map((c) => c.channelId);
    //     const res = await wrapApolloResult<{
    //         stateChannels: {
    //             totalCount: number;
    //             edges: {
    //                 cursor: string;
    //                 node: {
    //                     id: string;
    //                     spent: string;
    //                 };
    //             }[];
    //         };
    //     }>(
    //         this.apolloForMain.query({
    //             query: gql`
    //                 query ($height: String!, $channelIds: [String!]) {
    //                     stateChannels(
    //                         filter: { id: { in: $channelIds } }
    //                         first: 100
    //                         blockHeight: $height
    //                     ) {
    //                         totalCount
    //                         edges {
    //                             cursor
    //                             node {
    //                                 spent
    //                                 id
    //                             }
    //                         }
    //                     }
    //                 }
    //             `,
    //             variables: {
    //                 height: String(eraBlock),
    //                 channelIds,
    //             },
    //         }),
    //     );
    //     const edges: {
    //         cursor: string;
    //         node: {
    //             id: string;
    //             spent: string;
    //         };
    //     }[] = res.stateChannels.edges;
    //     if (res.stateChannels.totalCount > 100) {
    //         for (
    //             let i = 0;
    //             i < Math.ceil(res.stateChannels.totalCount / 100 - 1);
    //             i++
    //         ) {
    //             const cursor = edges[edges.length - 1].cursor;
    //             const r2 = await wrapApolloResult<{
    //                 stateChannels: {
    //                     edges: {
    //                         cursor: string;
    //                         node: {
    //                             id: string;
    //                             spent: string;
    //                         };
    //                     }[];
    //                 };
    //             }>(
    //                 this.apolloForMain.query({
    //                     query: gql`
    //                         query (
    //                             $height: String!
    //                             $channelIds: [String!]
    //                             $cursor: Cursor!
    //                         ) {
    //                             stateChannels(
    //                                 filter: { id: { in: $channelIds } }
    //                                 first: 100
    //                                 after: $cursor
    //                                 blockHeight: $height
    //                             ) {
    //                                 totalCount
    //                                 edges {
    //                                     cursor
    //                                     node {
    //                                         spent
    //                                         id
    //                                     }
    //                                 }
    //                             }
    //                         }
    //                     `,
    //                     variables: {
    //                         height: String(eraBlock),
    //                         channelIds,
    //                         cursor,
    //                     },
    //                 }),
    //             );
    //             edges.push(...r2.stateChannels.edges);
    //         }
    //     }
    //     return edges.map((edge) => {
    //         const startSpent =
    //             channels.find((c) => c.channelId === edge.node.id)?.startSpent ?? 0;
    //         const spent = Number(
    //             utils.formatEther(BigNumber(edge.node.spent).toFixed()),
    //         );
    //         return {
    //             channelId: edge.node.id,
    //             spent: spent - startSpent,
    //         };
    //     });
    // }

    async findEraDeploymentBoosterUnclaimedReward(
        era: number,
        consumer: string,
        deployment: string,
    ) {
        const blockNumber = await this.eraSvc.eraMostRecentBlock(era);
        const reward = await this.sdk.rewardsBooster.getQueryRewards(
            cidToBytes32(deployment),
            consumer,
            {
                blockTag: blockNumber,
            },
        );
        return Number(utils.formatEther(reward));
    }

    async findEraSpentDeploymentConsumerQueryReward(
        era: number,
        consumer: string,
        deployment: string,
    ) {
        const res = await wrapApolloResult<{
            boosterQueryRewardLogs: {
                aggregates: { sum: { paid: string; refund: string } };
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($era: Int!, $consumer: String!, $deployment: String!) {
                        boosterQueryRewardLogs(
                            filter: {
                                eraId: { equalTo: $era }
                                consumer: { equalTo: $consumer }
                                deployment: { equalTo: $deployment }
                            }
                        ) {
                            aggregates {
                                sum {
                                    paid
                                    refund
                                }
                            }
                        }
                    }
                `,
                variables: {
                    era,
                    consumer,
                    deployment,
                },
            }),
        );
        const paid = Number(
            utils.formatEther(
                BigNumber(res.boosterQueryRewardLogs.aggregates.sum.paid).toFixed(),
            ),
        );
        const refund = Number(
            utils.formatEther(
                BigNumber(res.boosterQueryRewardLogs.aggregates.sum.refund).toFixed(),
            ),
        );
        return paid - refund;
    }

    async findEraOperatorTotalGasSpent(era: number, operator: string) {
        const startOfEra = await this.eraSvc.eraFirstBlock(era);
        const endOfEra = await this.eraSvc.eraMostRecentBlock(era);
        const feeEnd = await wrapApolloResult<{
            indexerControllers: {
                aggregates: { sum: { accTotalGasPaid: string } };
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($height: String!, $operator: String!) {
                        indexerControllers(
                            blockHeight: $height
                            filter: { indexerId: { equalTo: $operator } }
                        ) {
                            aggregates {
                                sum {
                                    accTotalGasPaid
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(endOfEra),
                    operator,
                },
            }),
        );
        const feeStart = await wrapApolloResult<{
            indexerControllers: {
                aggregates: { sum: { accTotalGasPaid: string } };
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($height: String!, $operator: String!) {
                        indexerControllers(
                            blockHeight: $height
                            filter: { indexerId: { equalTo: $operator } }
                        ) {
                            aggregates {
                                sum {
                                    accTotalGasPaid
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(startOfEra),
                    operator,
                },
            }),
        );
        const feeEndNumber = Number(
            utils.formatEther(
                BigNumber(
                    feeEnd.indexerControllers.aggregates.sum.accTotalGasPaid,
                ).toFixed(),
            ),
        );
        const feeStartNumber = Number(
            utils.formatEther(
                BigNumber(
                    feeStart.indexerControllers.aggregates.sum.accTotalGasPaid,
                ).toFixed(),
            ),
        );
        return feeEndNumber - feeStartNumber;
    }

    async findEraDeploymentMissedLabor(
        era: number,
    ): Promise<
        { operator: string; deploymentId: string; missedLabor: string }[]
    > {
        const eraBlock = await this.eraSvc.eraMostRecentBlock(era);
        const res = await wrapApolloResult<{
            indexerMissedLabors: {
                totalCount: number;
                edges: {
                    cursor: string;
                    node: {
                        indexerId: string;
                        deploymentId: string;
                        missedLabor: string;
                    };
                }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($height: String!, $era: Int!) {
                        indexerMissedLabors(
                            blockHeight: $height
                            first: 100
                            filter: { eraIdx: { equalTo: $era } }
                        ) {
                            totalCount
                            edges {
                                cursor
                                node {
                                    indexerId
                                    deploymentId
                                    missedLabor
                                }
                            }
                        }
                    }
                `,
                variables: {
                    height: String(eraBlock),
                    era,
                },
            }),
        );

        const edges: {
            cursor: string;
            node: { indexerId: string; deploymentId: string; missedLabor: string };
        }[] = res.indexerMissedLabors.edges;
        if (res.indexerMissedLabors.totalCount > 100) {
            for (
                let i = 0;
                i < Math.ceil(res.indexerMissedLabors.totalCount / 100 - 1);
                i++
            ) {
                const cursor = edges[edges.length - 1].cursor;
                const r2 = await wrapApolloResult<{
                    indexerMissedLabors: {
                        edges: {
                            cursor: string;
                            node: {
                                indexerId: string;
                                deploymentId: string;
                                missedLabor: string;
                            };
                        }[];
                    };
                }>(
                    this.apolloForMain.query({
                        query: gql`
                            query ($height: String!, $era: Int!, $cursor: Cursor!) {
                                indexerMissedLabors(
                                    blockHeight: $height
                                    first: 100
                                    filter: { eraIdx: { equalTo: $era } }
                                    after: $cursor
                                ) {
                                    totalCount
                                    edges {
                                        cursor
                                        node {
                                            indexerId
                                            deploymentId
                                            missedLabor
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            height: String(eraBlock),
                            era,
                            cursor,
                        },
                    }),
                );
                edges.push(...r2.indexerMissedLabors.edges);
            }
        }
        return edges.map((edge) => ({
            operator: edge.node.indexerId,
            deploymentId: edge.node.deploymentId,
            missedLabor: edge.node.missedLabor,
        }));
    }

    async findCurrentConsumerTotalBoost(consumer: string) {
        const result = await wrapApolloResult<{
            deploymentBoosterSummaries: {
                aggregates: { sum: { totalAmount: string } };
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query ($consumer: String!) {
                        deploymentBoosterSummaries(
                            filter: {
                                totalAmount: {
                                    greaterThan: "0"
                                }
                                consumer: {
                                    equalTo: $consumer
                                }
                            }
                        ) {
                            aggregates{
                                sum{
                                    totalAmount
                                }
                            }
                        }
                    }
                `,
                variables: {
                    consumer,
                },
            }),
        );

        return Number(
            utils.formatEther(BigNumber(result.deploymentBoosterSummaries.aggregates.sum.totalAmount).toFixed()),
        );
    }

    async findCurrentConsumerAllProjectBoost(consumer: string) {
        const result = await wrapApolloResult<{
            deploymentBoosterSummaries: {
                totalCount: number;
                nodes: { totalAmount: string; deploymentId: string }[];
            };
        }>(
            this.apolloForStats.query({
                query: gql`
                    query ($consumer: String!) {
                        deploymentBoosterSummaries(
                            filter: {
                                totalAmount: {
                                    greaterThan: "0"
                                }
                                consumer: {
                                    equalTo: $consumer
                                }
                            }
                        ) {
                            totalCount
                            nodes{
                                totalAmount
                                deploymentId
                            }
                        }
                    }
                `,
                variables: {
                    consumer,
                },
            }),
        );

        return {
            total: result.deploymentBoosterSummaries.totalCount,
            boosts: result.deploymentBoosterSummaries.nodes.map(node => ({
                deploymentId: node.deploymentId,
                totalAmount: Number(utils.formatEther(BigNumber(node.totalAmount).toFixed()))
            }))
        };
    }

    async findCurrentDeploymentAllocation() {
        const result = await wrapApolloResult<{
            indexerAllocationSummaries: {
                groupedAggregates: { keys: string[]; sum: { totalAmount: string } }[];
            };
        }>(
            this.apolloForMain.query({
                query: gql`
                    query {
                        indexerAllocationSummaries(
                            filter: {totalAmount: {greaterThan: "0"}}
                        ) {
                            groupedAggregates(groupBy: DEPLOYMENT_ID) {
                                keys
                                sum {
                                    totalAmount
                                }
                            }
                        }
                    }
                `,
                variables: {},
            }),
        );
        return result.indexerAllocationSummaries.groupedAggregates.reduce((acc, {keys, sum: {totalAmount}}) => {
            acc[keys[0]] = Number(utils.formatEther(BigNumber(totalAmount).toFixed()));
            return acc;
        }, {} as { [key: string]: number });
    }
}
