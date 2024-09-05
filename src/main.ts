import ollama, {Tool} from 'ollama';
import readline from 'readline/promises'
import {IFunctionTool} from "./tools/base";
import {DeploymentBoostSummaryTool} from "./tools/DeploymentBoostSummaryTool";
import {SQTBalanceTool} from "./tools/SQTBalanceTool";
import {NodeOperatorSvc} from "./svc/nodeOperator.svc";
import {providers} from "ethers";
import {argv} from "./yargs";
import {ContractSDK} from "@subql/contract-sdk";
import {EraSvc} from "./svc/era.svc";
import {ContractSvc} from "./svc/contract.svc";
import {NodeOperatorRewardTool} from "./tools/NodeOperatorRewardTool";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const MAX_ITERATIONS = 10;
const DEBUG = true;
export const MODEL = 'llama3.1'; //llama3.1, llama3.1:70b, hermes3

export function debug(...args: Parameters<typeof console.log>) {
    if (DEBUG) {
        console.log('\x1b[33m[DEBUG]\x1b[0m', ...args);
    }
}

// Defines the overall behaviour
const DEFAULT_PROMPT = () => `You are an agent designed to assist Subquery Network user, you can call tools to help you answer questions,
all parameters required by tools should only be provided by the user. 
Do not answer questions not related to SubQuery Network.
Given an input question, invoke related tools, then look at the results and return the answer.
Only use the below tools. Only use the information returned by the below tools to construct your final answer.
If the tools suggest using other tools then you must use the other tools.
Token symbol if not specified, it should be assumed to be SQT.
If the question does not seem related to the API, just return "I don't know" as the answer.`

// Defines the overall behaviour


export async function RunWithTools(prompt: string, tools: IFunctionTool[]): Promise<string> {

    console.log('Prompt:', prompt)

    let numIterations = 0;

    const messages = [
        {role: 'system', content: DEFAULT_PROMPT()},
        {role: 'user', content: prompt},
    ];

    while (true) {
        const res = await ollama.chat({
            model: MODEL,
            stream: false,
            tools: tools.map(t => t.toTool()),
            messages,
        });

        if (!res.message.tool_calls?.length) {
            // Add the chat history
            messages.push(res.message);
            console.log(res.message.content);

            const response = await rl.question("Enter a message: ");
            messages.push({role: 'user', content: response});
        }

        const toolResponses = await Promise.all((res.message.tool_calls ?? []).map(async (toolCall) => {
            // debug('Tool call', toolCall);
            const tool = tools.find(t => t.name === toolCall.function.name);
            if (!tool) {
                throw new Error(`Unable to find tool called "${toolCall.function.name}"`);
            }
            debug(`Calling(${toolCall.function.name})`, toolCall.function.arguments);
            const res = await tool.call(toolCall.function.arguments);
            debug(`Result(${toolCall.function.name})`, toolCall.function.name, (res as string).substring(0, 500));
            return res;
        }));

        messages.push(...toolResponses.map(m => ({role: 'tool', content: `${m}`})));
        numIterations++;
    }

    // Limit the number of function calls
    return `No response in ${MAX_ITERATIONS} iterations`;
}


async function run(prompt: string): Promise<void> {
    const provider = new providers.StaticJsonRpcProvider(argv.rpcEndpoint);
    const sdk = ContractSDK.create(provider, {network: 'mainnet'});
    const contractSvc = new ContractSvc(sdk);
    const eraSvc = new EraSvc(sdk);
    const nodeOperatorSvc = new NodeOperatorSvc(sdk, eraSvc);
    const tools = [
        new DeploymentBoostSummaryTool(nodeOperatorSvc),
        new SQTBalanceTool(nodeOperatorSvc, contractSvc),
        new NodeOperatorRewardTool(nodeOperatorSvc, contractSvc),
    ];
    RunWithTools(prompt, tools)
        .then(r => console.log(`Response: ${r}`))
        .catch(e => console.error(`Failed to run`, e));
}

// run('Can you tell me how many SQT do I have? my wallet is 0x31E99bdA5939bA2e7528707507b017f43b67F89B'); // Working
// run('As a node operator, which deployment should I run? select top 3 for me');
run('How is my subquery network rewards?'); // Working
