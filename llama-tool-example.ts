
import { formatEther } from 'ethers';
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

const introspectionQuery = `
  query {
    __schema {
      types {
        name
        kind
        fields {
          name
        }
      }
    }
  }
`;

const fullIntrospectionQuery = `
{
  __schema {
    directives {
      name
      description
    }
    types {
      name
      description
    }
    queryType {
      name
      description
    }
    queryType {
      name
      description
    }
  }
}
`

export class IntrospectionTool extends FunctionTool {

  constructor(readonly endpoint: string) {
    super();
  }

  name = 'gql-introspection';
  description = `This tool gets the GraphQL schema definition that can be used to build a valid query.
  `;
  parameters = {
    type: 'null',
    required: [],
    properties: {},
  }

  async call(): Promise<string> {
    try {
      const res = await grahqlRequest(this.endpoint, fullIntrospectionQuery);

      return JSON.stringify(res);
    } catch (error) {
      return `${error}`;
    }
  }
}


class EntitiesTool extends FunctionTool {

  constructor(readonly endpoint: string) {
    super();
  }

  name = 'list-gql-entities';
  description = `Gets a list of types the graphql API provides.
    The output is a comma separated list of the types.

    Example output: "entity1, entity2, entity3".
  `;
  parameters = {
    type: 'null',
    required: [],
    properties: {},
  }

  async call(): Promise<string> {
    try {
      const res = await grahqlRequest(this.endpoint, introspectionQuery);

      const entities = res.__schema.types.filter(
        (type: { kind: string }) => type.kind === 'OBJECT'
      );

      // Model is reporting there are a lot of entities
      // return 'Deployment,Delegation,Delegator';

      // TODO this contains edges, aggregates and other things, this can be improved
      const entityNames =  entities
        .map((e: { name: string }) => e.name)
        .filter((e: string) => !e.endsWith('Aggregates') && !e.endsWith('Connection') && !e.endsWith('Edge') && !e.startsWith('_'))
        .join(',');
      return entityNames;
    } catch (error) {
      return `${error}`;
    }
  }
}

class EntityInfoTool extends FunctionTool {

  name = 'info-gql-entity';
  description = `Gets information about the fields on the given types available on the graphql API`;

  parameters = {
    type: 'object',
    required: ['input'],
    properties: {
      input: {
        type: 'string',
        description: 'A comma separated list of types to get information about their fields',
      }
    },
  }

  constructor(readonly endpoint: string) {
    super();
  }

  async call({ input }: { input: string }): Promise<any> {
    try {
      const res = await grahqlRequest(this.endpoint, introspectionQuery);

      const wanted = input.split(',').map(i => i.toLowerCase())

      const entities = res.__schema.types
        .filter((type: { kind: string }) => type.kind === 'OBJECT')
        .filter((type: { name: string}) => wanted.includes(type.name.toLowerCase()));

      return JSON.stringify(entities, null, 2);

      // TODO get the introspection query
      // const tables = input.split(",").map((table) => table.trim());
      // return await this.db.getTableInfo(tables);
    } catch (error) {
      return `${error}`;
    }
  }
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


// This doesn't work well as it doesn't have a context of the graphql schema
class GQLValidateTool extends FunctionTool {

  name = "gql-validate"
  description = `Use this tool to double check if your query is correct before executing it.
    Always use this tool before executing a query with query-gql!`;

  parameters = {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'A graphql query',
      },
    }
  };

  async call({ query }: { query: string }): Promise<string> {
    const res = await ollama.generate({
      stream: false,
      model: MODEL,
      prompt: `
    ${query}
Double check the graphql query above for common mistakes, including:
- Using NOT IN with NULL values
- Properly quoting identifiers with "
- Ensuring that all brackes and baces have matching closing brackes and braces
- Using the correct number of arguments for functions
- Casting to the correct data type

- ordering is done with the orderBy directive and the value is an enum based on the field name and direction in upper-camel-case format. e.g BALANCE_ASC
- when querying collections always use "nodes" around fields selection

If there are any of the above mistakes, rewrite the query. If there are no mistakes, just reproduce the original query.`
    });

    return res.response.trim();
  }
}

class TotalCountTool extends FunctionTool {
  name = "query-totalcount-gql";

  description = `This tool queries the count of a specific type in the graphql API.`

  parameters = {
    type: 'object',
    required: ['entity'],
    properties: {
      entity: {
        type: 'string',
        description: 'The name of the entity, it should be lowercase and plural',
      },
    }
  };

  constructor(readonly endpoint: string) {
    super();
  }

  async call({ entity } : { entity: string}) {
    try {
      const res =  await grahqlRequest(this.endpoint, `query { ${entity} { totalCount } }`);

      return JSON.stringify(res);
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
    return formatEther(hex)
  }
}

// const ENDPOINT = 'https://api.subquery.network/sq/subquery/subquery-mainnet';
export const ENDPOINT = 'http://localhots:3001';

const tools = [
  // new IntrospectionTool(ENDPOINT),
  // new GQLValidateTool(),
  // new EntitiesTool(ENDPOINT),
  // new EntityInfoTool(ENDPOINT),
  new QueryTool(ENDPOINT),
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

// run('Can you tell me how many projects there are?'); // Working
// run('Can you tell me about all the totalDelegations of a delegator with the id 0x108A496cDC32DA84e4D5905bb02ED695BC1024cd'); // Not working
run('Can you please get me 5 indexers ordered by their total stake?')
// run('Can you find me the delegator with the largest total delegations?'); // Not working
