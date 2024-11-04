import { Buffer } from "@std/io/buffer";
import { toWritableStream } from "@std/io/to-writable-stream";

export const CIDReg = new RegExp(
  /^ipfs:\/\/(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})([/?#][-a-zA-Z0-9@:%_+.~#?&//=]*)*$/i,
);

type ContentData = string | Uint8Array | Buffer | Blob;

type PathedContent = {
  content: ContentData;
  path: string;
};

type Content =
  | PathedContent
  | ContentData;

type AddOptions = {
  pin?: boolean;
  cidVersion?: number;
  wrapWithDirectory?: boolean;
};

type AddResult = {
  path: string;
  cid: string;
  size: number;
};

function isPathedContent(input: Content): input is PathedContent {
  return !!(input as PathedContent).content && !!(input as PathedContent).path;
}

export class IPFSClient {
  #endpoint: string;
  #headers?: Record<string, string>;

  constructor(endpoint: string, headers?: Record<string, string>) {
    this.#endpoint = endpoint;
    this.#headers = headers;
  }

  async cat(cid: string): Promise<Uint8Array> {
    const buf = new Buffer();

    const readStream = await this.catStream(cid);

    await readStream.pipeTo(toWritableStream(buf));

    return buf.bytes();
  }

  async catStream(cid: string): Promise<ReadableStream<Uint8Array>> {
    const url = new URL(`${this.#endpoint}/cat`);
    url.searchParams.append("arg", cid);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.#headers,
      },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    if (!res.body) {
      throw new Error("Missing response body");
    }

    return res.body;
  }

  async addFile(input: Content[], options?: AddOptions): Promise<AddResult[]> {
    const url = new URL(`${this.#endpoint}/add`);
    if (options) {
      url.searchParams.append("pin", options.pin?.toString() ?? "true");
      url.searchParams.append(
        "cid-version",
        options.cidVersion?.toString() ?? "0",
      );
      url.searchParams.append(
        "wrap-with-directory",
        options.wrapWithDirectory?.toString() ?? "false",
      );
    }

    const formData = this.makeFormData(input);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...this.#headers,
      },
      body: formData,
    });

    return await this.handleAddResponse(res);
  }

  // TODO this doesn't currently work as there is no way to use a stream in form data
  //   async addFileStream(input: ReadableStream<Uint8Array>, options?: AddOptions): Promise<AddResult[]> {
  //     const url = new URL(`${this.#endpoint}/add`);
  //     if (options) {
  //       url.searchParams.append("pin", options.pin?.toString() ?? "true");
  //       url.searchParams.append(
  //         "cid-version",
  //         options.cidVersion?.toString() ?? "0",
  //       );
  //       url.searchParams.append(
  //         "wrap-with-directory",
  //         options.wrapWithDirectory?.toString() ?? "false",
  //       );
  //     }

  //     const fd = new FormData()
  //     fd.append("data", input)

  //     const res = await fetch(url, {
  //         method: "POST",
  //         headers: {
  //           ...this.#headers,
  //           ...fd.getHeaders()
  //         },
  //         body: fd,
  //       });

  //     return await this.handleAddResponse(res);
  //   }

  private async handleAddResponse(res: Response): Promise<AddResult[]> {
    if (!res.ok) {
      throw new Error(await res.text());
    }

    // This could use typebox for runtime validation
    // deno-lint-ignore no-explicit-any
    const mapResponse = (raw: any): AddResult => ({
      path: raw.Name,
      cid: raw.Hash,
      size: parseInt(raw.Size, 10),
    });

    const data = await res.text();

    try {
      const jsonLines = (data.split("\n") as string[]).filter((l) => l !== "");

      return jsonLines.map((line) => JSON.parse(line)).map(mapResponse);
    } catch (e) {
      console.log("Raw response", data);
      throw e;
    }
  }

  private makeFormData(contents: Content[]): FormData {
    const formData = new FormData();
    for (const content of contents) {
      if (content instanceof Uint8Array) {
        formData.append("data", new Blob([content]));
      } else if (content instanceof Blob) {
        formData.append("data", content);
      } else if (typeof content === "string") {
        formData.append("data", content);
      } else if (isPathedContent(content)) {
        throw new Error("Pathed content not supported");
        // formData.append("data", content.content, { filename: content.path });
      } else {
        formData.append("data", new Blob([content.bytes()]));
      }
    }

    return formData;
  }
}
