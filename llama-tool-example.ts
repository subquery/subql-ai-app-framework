
import { utils } from 'ethers';
import { FunctionTool, MODEL, RunWithTools, debug } from './llama-tool';
import ollama from 'ollama';

async function grahqlRequest(endpoint: string, query: string, variables?: string): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const res = await response.json();

  console.log('XXXX raw response', res);

  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join('\n'));
  }

  return res.data;
}

class QueryTool extends FunctionTool {
  name = "query-gql";

  description = `Executes a graphql query on the API and returns a JSON string of the results.
  If the query returns an error, rewrite it and try again.`

  parameters = {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'A valid graphql query',
      },
      variables: {
        type: 'string',
        description: 'A JSON string containing variables for a graphql query',
      }
    }
  };

  constructor(readonly endpoint: string) {
    super();
  }

  async call({ query, variables } : { query: string, variables?: string}) {
    try {
      const res =  await grahqlRequest(this.endpoint, query, variables);
      return JSON.stringify(res);
    } catch (error) {
      console.log('ERROR running query', error)
      return `${error}`;
    }
  }
}


class SQTBalanceTool extends FunctionTool {
  name = "sqt-balance";

  description = `This tool queries different contracts for given wallet's SQT balance. A wallet is an ethereum compatible wallet starting from 0x, ask for user input when it is missing`

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

  constructor(readonly endpoint: string) {
    super();
  }

  async call({ wallet } : { wallet: string}) {
    try {
      // const res =  await grahqlRequest(this.endpoint, `query { ${entity} { totalCount } }`);
      if (!wallet || !wallet.startsWith('0x')) {
        return `error: wallet is missing`;
      }
      const res = {walletBalance: 100, stakedBalance: 20000, totalBoostedBalance: 1000};
      return JSON.stringify(res);
    } catch (error) {
      console.log('ERROR running query', error)
      return `${error}`;
    }
  }
}

class ProjectsTool extends FunctionTool {
  name = "projects";

  description = `This tool queries all projects published on SubQuery Network. It includes project name, network, description and all deployments belongs to the project.` +
  `total boost SQT is also included, so this data can be used to analysis project rewards`+
  `projectType is optional, don't try to put default value`;

  parameters = {
    type: 'object',
    required: [],
    properties: {
      projectType: {
        type: 'string',
        description: 'includes several possible options: subquery, dictionary, rpc, subgraph, llm',
      },
    }
  };

  constructor(readonly endpoint: string) {
    super();
  }

  async call({ projectType } : { projectType: string}) {
    try {
      const res = [
        {id: 1, name: 'Nova wallet polkadot',
          projectType: 'subquery',
          totalBoost: 10000,
          deployments: ['Qmofewexxxxfewljfiew']},
        {id: 2, name: 'Nova wallet kusama',
          projectType: 'subquery',
          totalBoost: 1000,
          deployments: ['Qm120004wljfiew']},
        {id: 3, name: 'Ethereum Full Node',
          projectType: 'rpc',
          totalBoost: 70000,
          deployments: ['Qm9hv0932ivowejfwljfiew']}
      ];
      return 'support content from tools: See following, with higher amount, it indicates higher reward for the deployment. \n' +
          ' [{"deploymentId":"QmWhwLQA4P6iZv6bmQxUqG5zumNK8KDBwcq8wxN4G213dq","amount":13000},{"deploymentId":"QmNg2PHAzBsP15RUbo9S5g6VnCjGdbEj2JTjo5u6rZa2km","amount":4000},{"deploymentId":"QmPC9vwiZhgsXJ9zGyB7j4zF7YcQxHjndgpLeGgtLTbVP6","amount":4258.568452113141},{"deploymentId":"QmZpj5wYpUbGqJDg6KWgbkK5bmeuCqYX6kwk317jdJ9DZ4","amount":2600},{"deploymentId":"QmVuajzRFLaMiu1LUnWfAUgZSoVVfLU1SfbUPBTLJwR48C","amount":13000},{"deploymentId":"QmeBTNuhahUo2EhTRxV3qVAVf5bC8zVQRrrHd3SUDXgtbF","amount":2600},{"deploymentId":"QmapQ6cNKPtZE1jkeUp5V6xy7sPSiJiZpoqZcRRtyc4Stq","amount":15942.007706986302},{"deploymentId":"QmVY6DSb4BmEo8zeFH3ZyX3kVg9WKMdWq2vm5YcAdt9FV2","amount":200.43618881824386},{"deploymentId":"QmdbxBVjARyGtCgqvyeXN9JAmsskFnVD7ngzrzrBRRknTS","amount":5000},{"deploymentId":"QmbtvVmnw2xsFrLEyp5oQWfunmaoDcJYPDttDHofkSM5j2","amount":5000},{"deploymentId":"QmaYR3CJyhywww1Cf5TMJP15DAcD3YE9ZSNmdLbM7KiQHi","amount":2600},{"deploymentId":"QmQNRgPter5Co6UbSChmhXsNR4VWx46kKVyu7TKe128YQM","amount":12442},{"deploymentId":"Qmd3hcVGc61HWxFF9JYVYn2LuxMXZxZqGq58XLxEq6TGpy","amount":5000},{"deploymentId":"QmcvcN4gZkiB2JkmK6BdHh7Wzy8Gfp8R7ZHSgGajbGv6Wy","amount":2600},{"deploymentId":"QmNevi2wSvFzigFXrQdPTQFQxVEbpfmZ2uLX1HKxYj5dY8","amount":1820},{"deploymentId":"QmejtwpwxCVPCYWzyPoX8Z2wgv2xeaovJMTxpDq7U1Pbm3","amount":5200},{"deploymentId":"QmbQmLgzmoFEhAsMZDB4pGZYznXHZSHENMki1ymbDowehY","amount":13000},{"deploymentId":"QmfVyLpFjkvT7DKU8hdqBpxKR677ak6bo7jeU68XsCPHLZ","amount":13000},{"deploymentId":"QmTTXz7yyxTSDHbSt8fLDbhzwQ3UwWC3jwvwnjZXvDQKuW","amount":5000},{"deploymentId":"QmYCeiJntvxURHq3j51yHsc8SnUMBbNX1HYFD4NGLBq7ka","amount":3900},{"deploymentId":"Qme1iQvwLoeh1ZLZVL4zDGZBK1hnMG3xZz1oaLBRvZxT7X","amount":2600},{"deploymentId":"QmPQQA28fxR1hePk25MHNS1vEYRs4Gbz3PXry8G4dfC76N","amount":2600},{"deploymentId":"QmUHAsweQYXYrY5Swbt1eHkUwnE5iLc7w9Fh62JY6guXEK","amount":13400},{"deploymentId":"QmPwGk3PBAmSra1vWriD5Hb3ZKZcGmP2xhCubVgw8JZ5y8","amount":5000},{"deploymentId":"QmaTy1aG5uZfeyUXRu8bDci1P6AzbTYBEzM57yEYk3MPEt","amount":9.8033992897e-7},{"deploymentId":"QmcoJLxSeBnGwtmtNmWFCRusXVTGjYWCK1LoujthZ2NyGP","amount":13000},{"deploymentId":"QmPiTswpMTeipwnmJkAcwkcg5Se8XfrucGYVKbwuAxQgJ6","amount":13000},{"deploymentId":"QmP2KRbGx4vLaL8HqugVXrNPMyziFL6aM9NAd4NbFqsPA9","amount":2600},{"deploymentId":"QmR5tfCMAoD162BpR1DxqvtZue5rQPQrMGqSHc4SsWS2ap","amount":5000},{"deploymentId":"QmeYyergeJvU26s9g46yXBEA8216vBmzpYZYjLQeW9MSb1","amount":5000},{"deploymentId":"QmZdLhKt44hmW56YS63rwr1NbkyGuG224oHjFypeXUiahW","amount":200},{"deploymentId":"Qmf6uZkxuNzpcNvnhReXrz1BTzMWgmtkdFQrSNByPytkuk","amount":7800},{"deploymentId":"QmWmm1teaAzm699PBQQ6MuEEmbNJubXHyTpWqCWKurqSNs","amount":7800},{"deploymentId":"QmPjq55mgUt9S8S491Q3wEbb87fXyEkdxymT6Gwe2xe1Z1","amount":2316.364904595383},{"deploymentId":"QmSKrk3BpzjWzKfS8sZRS5vyjmtXvkJnK8nHUVBhiCmz41","amount":1657.442063866097},{"deploymentId":"QmaUJQgjMw8ufsFW8nPnbgP3iGRknhKHB3z6S1WyHahsZ8","amount":5000},{"deploymentId":"QmTfhYrb3wusYS715KvHfaL56R8M1SrM8vwhuLyYVehfKB","amount":2600},{"deploymentId":"QmYNRtrcD2QKftkff2UpjV3fr3ubPZuYahTNDAct4Ad2NW","amount":5908},{"deploymentId":"QmWfoceNf5YApNdS6srEMBwUY3NKxWBDE2HuKoSokRpBws","amount":1700.18},{"deploymentId":"QmUAo3KNUiKpLwZXoygCF5cFLFxBoNbwWYJmhwQba672Dn","amount":5000},{"deploymentId":"QmPYABw93FKwx8zhzzCw6J69Y664RzFn8mUmThUsP1YWUR","amount":5000},{"deploymentId":"QmdiYhK86CA5B1pVWyQUp8ooA76bXpLoCAbX9tkfsF8zJ8","amount":7800},{"deploymentId":"QmeUZ2ooRyVpv7bQW2PMQUnxCe5YMZAsc6oKeSLaKwGo9m","amount":780},{"deploymentId":"QmZ5V3iNeivVvYVfr8Ui8XweXNwA98KpEo1rg55XiFvCbz","amount":3507.001066495434},{"deploymentId":"QmdzL852vGNgmdmk4UdvpPWeVsTtYJiMsjJd6ZxnSbQsfP","amount":2600},{"deploymentId":"QmWeQZWNrmHUvac2yz9ePpQqVwJM9QFpK9ULwt7ype3CmP","amount":5000},{"deploymentId":"QmdbhaQ6mFJNHVk5WbNyFsevfJysiXyueMRHqWN7FTXMtN","amount":7800},{"deploymentId":"QmeKUwv1ThJerboGV8t6zBYGCpJXkht1QMHY6QMU9xmWWm","amount":5000},{"deploymentId":"QmcDLFY7KixPJsryXXkaHas5kJUDvNoUvDqDgmnkKE7cjB","amount":7150},{"deploymentId":"QmXRb1jBQ9V2J9PAXNFyp4VvRke5V7oG33CoNu2P1r7qmy","amount":13000},{"deploymentId":"QmbReTnhCweQHmbXxgffkDqkkedo7ojjsUWTKopP1auuTp","amount":8310},{"deploymentId":"QmeBhTYHBcqJTJgfN7HDeSM4nHFR1c7fryZfRxGmRpwNHU","amount":5000},{"deploymentId":"QmdrqzazvSmrr6rgfxJEssJH9jqhYCZARm92UxNXMv5f86","amount":2600},{"deploymentId":"QmedaBa6JSumqLmjYm155sPqxsbt2gKaY1sfmunmgJzLhN","amount":4000},{"deploymentId":"Qmbe5g5vbEJYYAfpjcwNDzuhjeyaEQPQbxKyKx6PveYnR8","amount":14424.536322911255},{"deploymentId":"QmaDYnfKZohnH98zZQBxUSgnHKmbmwyA8VAf72EyA2zntC","amount":500},{"deploymentId":"QmUGBdhQKnzE8q6x6MPqP6LNZGa8gzXf5gkdmhzWjdFGfL","amount":13704.386465226436},{"deploymentId":"QmeMyqVHN7YxCHT6ftpaJ26APMCAPi4VfV5T1Zj8o8Cy3c","amount":2600},{"deploymentId":"QmdF4acjQ5YxwqPPgGoquYkb4jGgztHnjE8ifobiC2Ybif","amount":10400},{"deploymentId":"QmP1BMJoyJ5iFq6XLSfTJ3D23iWuTG1tnsEffJpNieQnwN","amount":2600},{"deploymentId":"QmbtSt8USCUTBWeAqevN1AwmUhKzqmtvhSdFYHYA1BviC8","amount":2600},{"deploymentId":"QmUj8yYCE1YU5UNdtm4q4di4GBDEAmL8vprSRWVGrYeEFm","amount":2600},{"deploymentId":"QmWtjALhGB9QEkf2GqVJued71xpLpP4jVUVh4vQDdrgXhv","amount":5000},{"deploymentId":"QmNa36oZ4zRS1i2wQhiFznU5DjEuNP3wopV6U3VcUWMUKu","amount":13000},{"deploymentId":"QmRonzFGNrsmpG2NrVhcVC6rCtCBqYFupX6MEECReWXWZT","amount":2800},{"deploymentId":"QmPkTXq1hw1MNt8rVEySAL3izgYa5jRdQbEK9AmERhcM2S","amount":5000},{"deploymentId":"QmWv9Ja5AQ9cPpXb6U7sGCvkhK6XbZ7xQntTBqidsSf5SF","amount":2600},{"deploymentId":"QmWD7SwH7aUyVvyydZRzS7XtM8bSU6izkvWgzYgrtw3V82","amount":5000},{"deploymentId":"QmVKG3gJejcPwKXHP1Yhk1tVTzKh4EZshpJSQyFtCeZkhc","amount":5000}]';
    } catch (error) {
      console.log('ERROR running query', error)
      return `${error}`;
    }
  }
}

class HexNumberTool extends FunctionTool {
  name = 'hex-to-number'
  description = `Converts a hex number to a decimal number`

  parameters = {
    type: 'object',
    required: ['hex'],
    properties: {
      hex: {
        type: 'string',
        description: 'A 0x prefixed hex string',
      },
      decimals: {
        type: 'number',
        description: 'The number of decimal places that can be used to '
      }
    }
  };

  async call({ hex }: { hex: string }) {
    return utils.formatEther(hex)
  }
}

// const ENDPOINT = 'https://api.subquery.network/sq/subquery/subquery-mainnet';
export const ENDPOINT = 'https://api.subquery.network/sq/subquery/subquery-mainnet';

const tools = [
  // new IntrospectionTool(ENDPOINT),
  // new GQLValidateTool(),
  // new EntitiesTool(ENDPOINT),
  // new EntityInfoTool(ENDPOINT),
  new SQTBalanceTool(ENDPOINT),
  new ProjectsTool(ENDPOINT),
  new HexNumberTool(),
  // new TotalCountTool(ENDPOINT),
];

async function run(prompt: string): Promise<void> {
  RunWithTools(prompt, tools)
    .then(r => console.log(`Response: ${r}`))
    .catch(e => console.error(`Failed to run`, e));
}

// RunWithTools('Can you tell me about all the details of a delegator with the address 0xe8888fb09cf575c333af560c2b881f761b735e42', tools)
//   .then(r => console.log(`Response: ${r}`))
//   .catch(e => console.error(`Failed to run`, e));

run('As a node operator, which project should I run?'); // Working
// run('which project has highest boost?');
// run('Can you tell me how many projects there are?'); // Working
// run('Can you tell me about all the totalDelegations of a delegator with the id 0x108A496cDC32DA84e4D5905bb02ED695BC1024cd'); // Not working
// run('Can you please get me 5 indexers ordered by their total stake?')
// run('Can you find me the delegator with the largest total delegations?'); // Not working
