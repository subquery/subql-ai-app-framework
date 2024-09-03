import {Tool} from "ollama";

export interface IFunctionTool {
    name: string;

    description: string;

    parameters: Tool['function']['parameters'];

    call: (args: any/* Record<string, any>*/) => Promise<any>;

    toTool: () => Tool;
}

export abstract class FunctionTool implements IFunctionTool {
    abstract name: string;
    abstract description: string;
    abstract parameters: Tool['function']['parameters'];
    abstract call(args: any/*Record<string, any>*/): Promise<any>;

    toTool(): Tool {
        return {
            type: 'function',
            function: {
                name: this.name,
                description: this.description,
                parameters: this.parameters,
            }
        }
    }
}