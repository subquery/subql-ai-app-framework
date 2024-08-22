import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
// import { OpenAI } from "@langchain/openai";
import { Tool } from "@langchain/core/tools";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
// import { LLMChain } from "langchain";
import { Ollama } from "@langchain/ollama";
// import { LLMChain } from "../chains/llm_chain.js";
// import type { SqlDatabase } from "../sql_db.js";
// import { SqlTable } from "../util/sql_utils.js";

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

/**
 * Interface for SQL tools. It has a `db` property which is a SQL
 * database.
 */
interface GraphqlTool {
  endpoint: string;
}

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

  if (res.error) {
    throw new Error(res.error);
  }

  return res.data;
}

/**
 * A tool for executing SQL queries. It takes a SQL database as a
 * parameter and assigns it to the `db` property. The `_call` method is
 * used to run the SQL query and return the result. If the query is
 * incorrect, an error message is returned.
 */
export class QueryGraphqlTool extends Tool implements GraphqlTool {
  static lc_name() {
    return "QueryGqklTool";
  }

  name = "query-gql";

  endpoint: string;

  constructor(endpoint: string) {
    super(...arguments);
    this.endpoint = endpoint;
  }

  /** @ignore */
  async _call(input: string) {
    console.log('Query gql', input)
    try {
      const res =  await grahqlRequest(this.endpoint, input);

      return res;
      // return await this.db.run(input);
    } catch (error) {
      console.log('ERROR running query', error)
      return `${error}`;
    }
  }

  description = `Input to this tool is a detailed and correct graphql query, output is a JSON result from the endpoint.
  If the query is not correct, an error message will be returned.
  If an error is returned, rewrite the query, check the query, and try again.`;
}

/**
 * A tool for retrieving information about SQL tables. It takes a SQL
 * database as a parameter and assigns it to the `db` property. The
 * `_call` method is used to retrieve the schema and sample rows for the
 * specified tables. If the tables do not exist, an error message is
 * returned.
 */
export class InfoGraphqlTool extends Tool implements GraphqlTool {
  static lc_name() {
    return "InfoGqlTool";
  }

  name = "info-gql";

  endpoint: string;

  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  /** @ignore */
  async _call(input: string) {
    console.log('Info tool', input)
    try {
      const res = await grahqlRequest(this.endpoint, introspectionQuery);

      const wanted = input.split(',')

      const entities = res.__schema.types
        .filter((type: { kind: string }) => type.kind === 'OBJECT')
        .filter((type: { name: string}) => wanted.includes(type.name));



      console.log('XXXX entities info', JSON.stringify(entities, null, 2));

      return JSON.stringify(entities, null, 2);

      // TODO get the introspection query
      // const tables = input.split(",").map((table) => table.trim());
      // return await this.db.getTableInfo(tables);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input to this tool is a comma-separated list of entities, output is the schema and sample rows for those entities.
    Be sure that the entities actually exist by calling list-tables-gql first!

    Example Input: "entity1, entity2, entity3.`;
}

/**
 * A tool for listing all tables in a SQL database. It takes a SQL
 * database as a parameter and assigns it to the `db` property. The
 * `_call` method is used to return a comma-separated list of all tables
 * in the database.
 */
export class ListTablesGraphqlTool extends Tool implements GraphqlTool {
  static lc_name() {
    return "ListTablesGqlTool";
  }

  name = "list-tables-gql";

  endpoint: string;

  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  async _call(_: string) {
    console.log('List tables query');
    try {
      const res = await grahqlRequest(this.endpoint, introspectionQuery);

      const entities = res.__schema.types.filter(
        (type: { kind: string }) => type.kind === 'OBJECT'
      );

      // Model is reporting there are a lot of entities
      return 'Deployment,Delegation,Delegator';

      // TODO this contains edges, aggregates and other things, this can be improved
      const entityNames =  entities
        .map((e: { name: string }) => e.name)
        .filter((e: string) => !e.endsWith('Aggregates') && !e.endsWith('Connection') && !e.endsWith('Edge') && !e.startsWith('_'))
        .join(',');

      console.log('XXXX entities', entityNames);
      return entityNames;
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input is an empty string, output is a comma-separated list of entities in the database.`;
}

/**
 * Arguments for the QueryCheckerTool class.
 */
type QueryCheckerToolArgs = {
  llm?: BaseLanguageModelInterface;
};

/**
 * A tool for checking SQL queries for common mistakes. It takes a
 * LLMChain or QueryCheckerToolArgs as a parameter. The `_call` method is
 * used to check the input query for common mistakes and returns a
 * prediction.
 */
export class QueryCheckerTool extends Tool {
  static lc_name() {
    return "QueryCheckerTool";
  }

  name = "query-checker";

  template = `
    {query}
Double check the graphql query above for common mistakes, including:
- Using NOT IN with NULL values
- Properly quoting identifiers with "
- Ensuring that all brackes and baces have matching closing brackes and braces
- Using the correct number of arguments for functions
- Casting to the correct data type

If there are any of the above mistakes, rewrite the query. If there are no mistakes, just reproduce the original query.`;

  promptTemplate: ChatPromptTemplate;
  llm: BaseLanguageModelInterface;

  constructor(llmChainOrOptions?: QueryCheckerToolArgs) {
    super();

    this.promptTemplate = ChatPromptTemplate.fromTemplate(this.template);
    this.llm = llmChainOrOptions?.llm ?? new Ollama({ model: "llama3.1" });

    // if (typeof llmChainOrOptions?._chainType === "function") {
    //   this.llmChain = llmChainOrOptions as LLMChain;
    // } else {
    //   if (options?.llmChain !== undefined) {
    //     this.llmChain = options.llmChain;
    //   } else {
    //     const prompt = new PromptTemplate({
    //       template: this.template,
    //       inputVariables: ["query"],
    //     });
    //     const llm = options?.llm ?? new Ollama({ model: "llama3.1" });
    //     this.llmChain = new LLMChain({ llm, prompt });
    //   }
    // }
  }

  /** @ignore */
  async _call(input: string) {
    console.log('Check query', input);

    const llmRes = await this.promptTemplate.pipe(this.llm).invoke({ query: input })
    // const llmRes = await this.llm.invoke({ query: input } as any);
    console.log('check query llm res', llmRes.content)

    return llmRes.content
  }

  description = `Use this tool to double check if your query is correct before executing it.
    Always use this tool before executing a query with query-gql!`;
}
