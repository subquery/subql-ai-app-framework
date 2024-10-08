import ora from "ora";
import type { Message } from "ollama";
import { brightMagenta, brightRed } from "@std/fmt/colors";
import type { ChatResponse } from "./http.ts";
import { getPrompt } from "./util.ts";

export async function httpCli(host: string): Promise<void> {
  const messages: Message[] = [];

  while (true) {
    const response = getPrompt();
    if (!response) {
      continue;
    }

    messages.push({ content: response, role: "user" });

    const spinner = ora({
      text: "",
      color: "yellow",
      spinner: "simpleDotsScrolling",
      discardStdin: false,
    }).start();

    const r = await fetch(`${host}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        messages,
        n: 1,
        stream: false,
      }),
    });

    if (!r.ok) {
      console.error("Response error", r.status, await r.text());
      throw new Error("Bad response");
    }

    const resBody: ChatResponse = await r.json();

    const res = resBody.choices[0]?.message;
    if (!res) {
      spinner.fail(brightRed("Received invalid response message"));
      continue;
    }

    messages.push(res);

    spinner.stopAndPersist({
      text: `${brightMagenta(res.content)}`,
    });
  }
}
