
import { describe, test, expect } from 'vitest';
import { Type, type Static } from '@sinclair/typebox';
import { getProjectFromEntrypoint } from './project';

describe('project initialization', () => {
  test('loads a valid project WITH a config', () => {
    const configType = Type.Object({
      TEST_OPT: Type.String({ default: 'test-opt'})
    })
    expect(getProjectFromEntrypoint({
      configType,
      projectFactory: (config: Static<typeof configType>) => Promise.resolve({
        model: 'test-model',
        prompt: 'you are a test behave like a test:' + config.TEST_OPT,
        tools: [],
      })
    })).resolves.toEqual({
      model: 'test-model',
      prompt: 'you are a test behave like a test:test-opt',
      tools: [],
    });
  });

  test('loads a valid project WITHOUT a config', () => {
    expect(getProjectFromEntrypoint({
      projectFactory: () => Promise.resolve({
        model: 'test-model',
        prompt: 'you are a test behave like a test',
        tools: [],
      })
    })).resolves.not.toThrow();
  });

  test('handles an invalid entrypoint', () => {
    expect(() => getProjectFromEntrypoint(null)).rejects.toThrow('Project entry is invalid');
    expect(() => getProjectFromEntrypoint(undefined)).rejects.toThrow('Project entry is invalid');
    expect(() => getProjectFromEntrypoint({})).rejects.toThrow('Expected union value'); // TODO return better error message
  })

  test('handles an invalid conifg', () => {
    const configType = Type.Object({
      TEST_OPT: Type.String()
    })
    expect(getProjectFromEntrypoint({
      configType,
      projectFactory: (config: Static<typeof configType>) => Promise.resolve({
        model: 'test-model',
        prompt: 'you are a test behave like a test:' + config.TEST_OPT,
        tools: [],
      })
    })).rejects.toThrow("Expected required property"); // TODO return better error message
  })

  test('handles errors calling projectFactory', () => {
    expect(getProjectFromEntrypoint({
      projectFactory: () => Promise.reject(new Error("Failed to create a project"))
    })).rejects.toThrow("Failed to create a project");
  })

  test('handles an invalid project', () => {
    expect(getProjectFromEntrypoint({
      projectFactory: () => Promise.resolve({
        foo: 'bar'
      })
    })).rejects.toThrow("Expected required property"); // TODO return better error message
  });
});
