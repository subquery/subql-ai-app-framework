// This file is based on https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/lib/generate-embeddings.ts

// @ts-types="npm:@types/estree"
// import { ObjectExpression } from 'estree';
// import type { ObjectExpression } from "https://esm.sh/@types/estree@1.0.5";

// @#ts-types="npm:@types/mdast@^4.04"
import type { Content, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown, type MdxjsEsm } from "mdast-util-mdx";
import { toMarkdown } from "mdast-util-to-markdown";
import { toString } from "mdast-util-to-string";
import { mdxjs } from "micromark-extension-mdxjs";
import { u } from "unist-builder";
import { filter } from "unist-util-filter";
import { createHash } from "node:crypto";
import GithubSlugger from "github-slugger";
import { extname } from "@std/path/extname";

type PlainValue = string | number | bigint | boolean | RegExp | undefined;
type PlainObj = Record<string, PlainValue>;
type ObjectExpression = {
  // deno-lint-ignore no-explicit-any
  properties: any[] /*{
    type: string;
    key: { type: string; name?: string };
    value: { type: string; value?: PlainValue | null };
  }[]*/;
};

/**
 * Extracts ES literals from an `estree` `ObjectExpression`
 * into a plain JavaScript object.
 */
function getObjectFromExpression(node: ObjectExpression): PlainObj {
  return node.properties.reduce<PlainObj>((object, property) => {
    if (property.type !== "Property") {
      return object;
    }

    const key = (property.key.type === "Identifier" && property.key.name) ||
      undefined;
    const value = (property.value.type === "Literal" && property.value.value) ||
      undefined;

    if (!key) {
      return object;
    }

    return {
      ...object,
      [key]: value,
    };
  }, {});
}

/**
 * Extracts the `meta` ESM export from the MDX file.
 *
 * This info is akin to frontmatter.
 */
function extractMetaExport(mdxTree: Root) {
  // @ts-ignore: this file was converted from nodejs. There are some type checks that don't seem to be working
  const metaExportNode = mdxTree.children.find((node): node is MdxjsEsm => {
    return (
      node.type === "mdxjsEsm" &&
      node.data?.estree?.body[0]?.type === "ExportNamedDeclaration" &&
      node.data.estree.body[0].declaration?.type === "VariableDeclaration" &&
      node.data.estree.body[0].declaration.declarations[0]?.id.type ===
        "Identifier" &&
      node.data.estree.body[0].declaration.declarations[0].id.name === "meta"
    );
  });

  if (!metaExportNode) {
    return undefined;
  }

  const objectExpression =
    (metaExportNode.data?.estree?.body[0]?.type === "ExportNamedDeclaration" &&
      metaExportNode.data.estree.body[0].declaration?.type ===
        "VariableDeclaration" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0]?.id
          .type === "Identifier" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].id.name ===
        "meta" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].init
          ?.type ===
        "ObjectExpression" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].init) ||
    undefined;

  if (!objectExpression) {
    return undefined;
  }

  return getObjectFromExpression(objectExpression);
}

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
function splitTreeBy(
  tree: Root,
  predicate: (node: Content) => boolean,
): Root[] {
  // @ts-ignore: this file was converted from nodejs. There are some type checks that don't seem to be working
  return tree.children.reduce<Root[]>((trees, node) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree: Root = u("root", [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

type Meta = ReturnType<typeof extractMetaExport>;

type Section = {
  content: string;
  heading?: string;
  slug?: string;
};

type ProcessedMdx = {
  checksum: string;
  meta: Meta;
  sections: Section[];
};

/**
 * Processes MDX content for search indexing.
 * It extracts metadata, strips it of all JSX,
 * and splits it into sub-sections based on criteria.
 */
function processMdxForSearch(
  content: string,
  type: "md" | "mdx",
): ProcessedMdx {
  const checksum = createHash("sha256").update(content).digest("base64");

  const mdxTree = fromMarkdown(
    content,
    type === "mdx"
      ? {
        extensions: [mdxjs()],
        mdastExtensions: [mdxFromMarkdown()],
      }
      : undefined,
  );

  const meta = extractMetaExport(mdxTree);

  // Remove all MDX elements from markdown
  const mdTree = filter(
    mdxTree,
    (node) =>
      ![
        "mdxjsEsm",
        "mdxJsxFlowElement",
        "mdxJsxTextElement",
        "mdxFlowExpression",
        "mdxTextExpression",
      ].includes(node.type),
  );

  if (!mdTree) {
    return {
      checksum,
      meta,
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === "heading");

  const slugger = new GithubSlugger();

  const sections = sectionTrees.map((tree) => {
    const [firstNode] = tree.children;

    const heading = firstNode.type === "heading"
      ? toString(firstNode)
      : undefined;
    const slug = heading ? slugger.slug(heading) : undefined;

    return {
      content: toMarkdown(tree),
      heading,
      slug,
    };
  });

  return {
    checksum,
    meta,
    sections,
  };
}

export abstract class BaseEmbeddingSource {
  checksum?: string;
  meta?: Meta;
  sections?: Section[];

  constructor(
    public source: string,
    public path: string,
    public parentPath?: string,
  ) {}

  abstract load(): Promise<{
    checksum: string;
    meta?: Meta;
    sections: Section[];
  }>;
}

export class MarkdownEmbeddingSource extends BaseEmbeddingSource {
  type: "markdown" = "markdown";

  constructor(
    source: string,
    public filePath: string,
    public parentFilePath?: string,
  ) {
    const path = filePath.replace(/^pages/, "").replace(/\.mdx?$/, "");
    const parentPath = parentFilePath?.replace(/^pages/, "").replace(
      /\.mdx?$/,
      "",
    );

    super(source, path, parentPath);
  }

  async load() {
    const contents = await Deno.readTextFile(this.filePath);

    const type = extname(this.filePath) === ".mdx" ? "mdx" : "md";

    const { checksum, meta, sections } = processMdxForSearch(contents, type);

    this.checksum = checksum;
    this.meta = meta;
    this.sections = sections;

    return {
      checksum,
      meta,
      sections,
    };
  }
}
