

import * as rpc from 'vscode-jsonrpc';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc/browser.js';
import { Init, GetConfig, CallTool, IProjectJson, Load } from './messages.ts';

import { getProjectFromEntrypoint, IProject, IProjectEntrypoint } from "../../project/project.ts";


const conn = rpc.createMessageConnection(
    new BrowserMessageReader(self),
    new BrowserMessageWriter(self),
);

let entrypoint: IProjectEntrypoint;
let project: IProject;

function toJsonProject(): IProjectJson {
    return {
        model: project.model,
        prompt: project.prompt,
        userMessage: project.userMessage,
        tools: project.tools.map(t => t.toTool()),
    }
}

conn.onRequest(Load, async (path) => {
    entrypoint ??= (await import(path)).entrypoint;
})

conn.onRequest(Init, async (config) => {
    if (!entrypoint) {
        throw new Error("Please call `load` first");
    }
    
    project ??= await getProjectFromEntrypoint(entrypoint, config);
    
    return toJsonProject()
});

conn.onRequest(GetConfig, () => {
    if (!entrypoint) {
        throw new Error('Project is not initialized');
    }
    return entrypoint.configType;
});

conn.onRequest(CallTool, (toolName, args) => {
    if (!project) {
        throw new Error('Project is not initialized');
    }

    const tool = project.tools.find(t => t.name === toolName);

    if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
    }

    return tool.call(args);
});

conn.listen();

