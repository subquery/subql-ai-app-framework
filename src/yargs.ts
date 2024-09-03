// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';


function getYargsOption() {
  return yargs(hideBin(process.argv))
    .env()
    .options({
      'rpc-endpoint': {
        type: 'string',
        describe: 'Specify rpc endpoint for base',
        demandOption: true,
        default: 'https://mainnet.base.org',
      },
      ipfs: {
        type: 'string',
        describe: 'Specify ipfs endpoint for this network',
        default: 'https://unauthipfs.subquery.network/ipfs/api/v0',
      },
      port: {
        type: 'number',
        describe: 'Port the service will listen on',
        default: 8000,
      },
      'node-env': {
        type: 'string',
        describe: '',
        default: '',
      },
    });
}

export const argv = getYargsOption().parseSync();
