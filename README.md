## AI Framework

### Usage

To run the sample project run the following command:

`./src/index.ts -p ./subquery-delegator/index.ts`

### Generating embedded data

MD(X) data can be stored in a Lance DB for RAG data. To generate this db you can
run a command like so:

`./src/index.ts embed-mdx -i /Users/scotttwiname/Projects/subql-docs/docs -o ./.db -t subql-docs`

### Get info on a project

`./src/index.ts info -p ./subquery-delegator/index.ts`

## Tests

Running tests: `deno test`
