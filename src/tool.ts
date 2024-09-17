import { Tool } from "ollama";

type Parameters = Tool["function"]["parameters"];

// Utility type to map the "type" string to actual TypeScript types
type MapToTypes<T extends string> = T extends "string" ? string
  : T extends "number" ? number
  : T extends "boolean" ? boolean
  : unknown;

// Extract required and optional parameters
type ExtractParameters<P extends Tool["function"]["parameters"]> = {
  [K in keyof P["properties"]]: P["properties"][K]["enum"] extends string[]
    ? P["properties"][K]["enum"][number] // Enum types
    : MapToTypes<P["properties"][K]["type"]>; // Regular types
};

type RequiredParams<P extends Parameters> = {
  [
    K in keyof ExtractParameters<P> as K extends P["required"][number] ? K
      : never
  ]: ExtractParameters<P>[K];
};

type OptionalParams<P extends Parameters> = {
  [
    K in keyof ExtractParameters<P> as K extends P["required"][number] ? never
      : K
  ]?: ExtractParameters<P>[K];
};

export interface IFunctionTool<P extends Parameters = Parameters> {
  name: string;

  description: string;

  parameters: P;

  call: (args: any /*RequiredParams<P> & OptionalParams<P>*/) => Promise<any>;

  toTool: () => Tool;
}

// TODO map paramaters type to call args, it doesn't seem to be able to inferred with typescript without being explicit on the generic param
export abstract class FunctionTool /*<P extends Parameters>*/
  implements IFunctionTool<Parameters> {
  name = this.constructor.name;

  abstract parameters: Parameters;
  abstract description: string;
  abstract call(
    args: Record<any, any>, /*RequiredParams<P> & OptionalParams<P>*/
  ): Promise<any>;

  toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
