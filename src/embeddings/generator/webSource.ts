// import { chromium, firefox, type LaunchOptions, type Page } from 'playwright';

import { launch, type Page } from "jsr:@astral/astral";

type PageData = {
  links: { href: string; text?: string }[];
  text: string[];
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
    const [links, text] = await Promise.all([
      extractLinks(page),
      visibleText(page),
    ]);

    await page.close();

    return {
      links,
      text,
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

    yield { url, data: result };
  }

  await browser.close();
}

async function extractLinks(
  page: Page,
): Promise<{ href: string; text?: string }[]> {
  const elements = await page.$$("a");

  return (await Promise.all(elements.map(async (element) => ({
    href: await element.getAttribute("href"),
    text: await element.innerText(),
  })))).filter((r) => !!r.href);
}

async function visibleText(page: Page): Promise<string[]> {
  const raw = await page.evaluate(() => {
    // This runs in the browser env
    return Array.from(document.querySelectorAll("*"))
      .filter((element) => {
        const style = globalThis.getComputedStyle(element);
        return style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity != 0 &&
          !["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "HTML"].includes(
            element.tagName,
          );
      })
      .map((element) => element.textContent?.trim())
      .filter((text) => text);
  });

  return [...new Set([...raw])];
}
