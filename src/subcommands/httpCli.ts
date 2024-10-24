import ora from "ora";
import type { Message } from "ollama";
import { brightMagenta, brightRed } from "@std/fmt/colors";
import { getPrompt } from "../util.ts";
import OpenAI from "openai";
import process from "node:process";

export async function httpCli(host: string, stream = true): Promise<void> {
  let messages: Message[] = [];

  const client = new OpenAI({
    baseURL: `${host}/v1`,
  });

  console.log(`Special messages:
    ${brightMagenta("/bye")}: to exit (ctrl + c also works)
    ${brightMagenta("/clear")}: to remove all previous chat history
`);

  while (true) {
    const response = getPrompt();
    if (!response) {
      continue;
    }

    if (response === "/clear") {
      messages = [];
      console.log("Cleared chat history");
      continue;
    }

    messages.push({ content: response, role: "user" });
    const spinner = ora({
      text: "",
      color: "yellow",
      spinner: "simpleDotsScrolling",
      discardStdin: false,
    }).start();

    try {
      if (stream) {
        const stream = await client.chat.completions.create({
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          model: "",
          stream: true,
        });

        let stoppedSpinner = false;

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          // Content might be empty to keep the connection alive
          if (content) {
            // Stop spinner on first content
            if (!stoppedSpinner) {
              stoppedSpinner = true;
              spinner.stop();
            }

            process.stdout.write(brightMagenta(content));
          }
        }
        process.stdout.write("\n");
      } else {
        const completion = await client.chat.completions.create({
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          model: "",
        });

        const res = completion.choices[0]?.message;
        if (!res) {
          throw new Error("Received invalid response message");
        }
        if (!res.content) {
          throw new Error("Empty content");
        }

        messages.push(res as Message);

        spinner.stopAndPersist({
          text: `${brightMagenta(res.content)}`,
        });
      }
    } catch (e) {
      spinner.fail(brightRed((e as Error).message));
    }
  }
}
