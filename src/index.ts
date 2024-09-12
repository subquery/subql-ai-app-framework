#!/usr/bin/env vite-node --script

import yargs from 'yargs/yargs';
import { runApp } from './app';

yargs(process.argv.slice(2))
  .command(
    '$0',
    'Run an AI app',
    {
      project: {
        alias: 'p',
        description: 'A path to a project file',
        type: 'string',
        required: true,
      },
      host: {
        alias: 'h',
        description: 'The ollama RPC host',
        default: 'http://localhost:11434',
        type: 'string',
      },
      interface: {
        alias: 'i',
        description: 'The interface to interact with the app',
        type: 'string',
        choices: ['cli', 'http'],
        default: 'cli'
      },
    },
    (argv) => {
      return runApp({
        projectPath: argv.project,
        host: argv.host,
        interface: argv.interface as 'cli' | 'http',
      });
    }
  )
  .help()
  .argv;
