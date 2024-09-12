import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

// TODO link this to the types defined in tool
export const FunctionToolType = Type.Object({
  name: Type.String(),
  description: Type.String(),

  parameters: Type.Any(),

  call: Type.Function([Type.Any()], Type.Promise(Type.Any())),
  toTool: Type.Function([], Type.Any()),
});

export const Project = Type.Object({
  model: Type.String({
    description: 'The llm model to use'
  }),
  prompt: Type.String({
    description: 'The initial system prompt of the app'
  }),
  userMessage: Type.Optional(Type.String({
    description: 'An initial message to present to the user',
  })),
  tools: Type.Array(FunctionToolType),
});

export type IProject = Static<typeof Project>;

export function validateProject(project: any): void {
  return Value.Assert(Project, project);
}
