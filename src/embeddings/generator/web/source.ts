// import { chromium, firefox, type LaunchOptions, type Page } from 'playwright';

import { launch, type Page } from "jsr:@astral/astral";
import { createHash } from "node:crypto";

type LinkData = {
  href: string;
  text?: string;
};

type Chunk = {
  text: string;
  nearestAnchor?: string;
};

type PageData = {
  links: LinkData[];
  text: Chunk[];
  contentHash: string;
};

/**
 * The scope of links to follow
 *   * `none`: Only the page of the provided url will be crawled
 *   * `domain`: Only links with the matching domain are crawled
 *   * `subcomains`: Only links with the matching domain and subdomains are crawled. e.g subquery.network and app.subquery.network
 */
export type Scope = "none" | "domain" | "subdomains";

export async function* crawlWebSource(
  url: string,
  searchScope: Scope = "domain",
): AsyncIterable<{ url: string; data: PageData }> {
  const browser = await launch({
    headless: true,
  });

  const results = new Map<string, PageData>();

  const scrapePage = async (url: string): Promise<PageData> => {
    const page = await browser.newPage(url);

    const [links, text, contentHash] = await Promise.all([
      extractLinks(page),
      visibleText(page),
      page.content().then((content) => {
        return createHash("sha256").update(content).digest("base64");
      }),
    ]);

    await page.close();

    return {
      links,
      text,
      contentHash,
    };
  };

  const toScrape: string[] = [url];

  // Hostname used to determine whether links should be followed
  const hostname = new URL(url).host;

  while (toScrape.length) {
    const url = toScrape.shift();

    // Check it hasn't already been scraped.
    if (!url || results.has(url)) continue;

    const result = await scrapePage(url);
    // Save the results
    results.set(url, result);

    yield { url, data: result };

    if (searchScope === "none") {
      break;
    }

    // Find any new links to scrape
    const newToScrape = result.links
      .map((l) => l.href) // Only care about the links
      .map((l) => new URL(l, url)) // Convert relative links to full links
      .filter((l) =>
        searchScope === "subdomains"
          ? l.hostname.includes(hostname)
          : l.hostname === hostname
      ) // Limit crawling to certain domains
      .map((l) => l.toString());

    toScrape.push(...newToScrape);
  }

  await browser.close();
}

async function extractLinks(
  page: Page,
): Promise<LinkData[]> {
  const elements = await page.$$("a");

  const links = await Promise.all(elements.map(async (element) => ({
    href: await element.getAttribute("href"),
    text: await element.innerText(),
  })));

  return links.filter((r) => r.href !== null) as LinkData[];
}

async function visibleText(page: Page): Promise<Chunk[]> {
  const content = await page.evaluate(() => {
    // @ts-ignore this runs in the browser env
    function getClosestAnchor(el: Element): string | undefined {
      let parent = el;
      while (parent) {
        const anchor = parent.closest("a");
        if (anchor && anchor.href) return anchor.href;
        parent = parent.parentElement!;
      }
      return undefined; // Return empty if no anchor is found
    }

    const data: Chunk[] = [];

    // @ts-ignore this runs in the browser env
    document.querySelectorAll("h1, h2, h3, p").forEach((el) => {
      const text = el.textContent?.trim();
      if (!text) return;
      data.push({
        text,
        nearestAnchor: getClosestAnchor(el),
      });
    });

    return data;
  });

  return content;
}
