import { type TSchema, type Static } from '@sinclair/typebox';
import { Value } from "@sinclair/typebox/value";

export function loadConfigFromEnv<T extends TSchema>(schema?: T): Static<T> | undefined {
    if (!schema) return undefined;
    const envObj = Deno.env.toObject();
    return Value.Parse(schema, envObj);
}