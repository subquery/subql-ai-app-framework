import { expect } from "jsr:@std/expect";
import { type Static, Type } from "@sinclair/typebox";
import { getProjectFromEntrypoint } from "./project.ts";

Deno.test("loads a valid project WITH a config", async () => {
  const configType = Type.Object({
    TEST_OPT: Type.String({ default: "test-opt" }),
  });
  await expect(getProjectFromEntrypoint({
    configType,
    projectFactory: (config: Static<typeof configType>) =>
      Promise.resolve({
        model: "test-model",
        systemPrompt: "you are a test behave like a test:" + config.TEST_OPT,
        tools: [],
      }),
  })).resolves.toEqual({
    model: "test-model",
    systemPrompt: "you are a test behave like a test:test-opt",
    tools: [],
  });
});

Deno.test("loads a valid project WITHOUT a config", async () => {
  await expect(getProjectFromEntrypoint({
    projectFactory: () =>
      Promise.resolve({
        model: "test-model",
        systemPrompt: "you are a test behave like a test",
        tools: [],
      }),
  })).resolves.not.toThrow();
});

Deno.test("handles an invalid entrypoint", async () => {
  await expect(getProjectFromEntrypoint(null)).rejects.toThrow(
    "Project entry is invalid",
  );
  await expect(getProjectFromEntrypoint(undefined)).rejects.toThrow(
    "Project entry is invalid",
  );
  await expect(getProjectFromEntrypoint({})).rejects.toThrow(
    "Expected union value",
  ); // TODO return better error message
});

Deno.test("handles an invalid conifg", async () => {
  const configType = Type.Object({
    TEST_OPT: Type.String(),
  });
  await expect(getProjectFromEntrypoint({
    configType,
    projectFactory: (config: Static<typeof configType>) =>
      Promise.resolve({
        model: "test-model",
        systemPropmt: "you are a test behave like a test:" + config.TEST_OPT,
        tools: [],
      }),
  })).rejects.toThrow("Expected required property"); // TODO return better error message
});

Deno.test("handles errors calling projectFactory", async () => {
  await expect(getProjectFromEntrypoint({
    projectFactory: () =>
      Promise.reject(new Error("Failed to create a project")),
  })).rejects.toThrow("Failed to create a project");
});

Deno.test("handles an invalid project", async () => {
  await expect(getProjectFromEntrypoint({
    projectFactory: () =>
      Promise.resolve({
        foo: "bar",
      }),
  })).rejects.toThrow("Expected required property"); // TODO return better error message
});
