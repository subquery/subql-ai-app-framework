import { type Static, Type } from "@sinclair/typebox";

export const ContextType = Type.Object({
  vectorSearch: Type.Function(
    [
      Type.String({ description: "The table of the query" }),
      Type.Array(Type.Number(), {
        description: "The embedded vector result from `computeQueryEmbedding`",
      }),
    ],
    Type.Promise(Type.Array(Type.Any())),
    {
      description: "Perform a vector search on the db",
    },
  ),

  computeQueryEmbedding: Type.Function(
    [
      Type.String({ description: "The search query" }),
    ],
    Type.Promise(Type.Array(Type.Number())),
    { description: "Generate vector embeddings from an input" },
  ),
});

export type IContext = Static<typeof ContextType>;
