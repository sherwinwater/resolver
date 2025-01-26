import { writeFile, readFile, access } from "fs/promises";
import { connect } from "puppeteer-real-browser";

async function appendToFile(filename, data) {
    try {
        let existingData = [];
        try {
            await access(filename);
            const fileContent = await readFile(filename, "utf8");
            existingData = JSON.parse(fileContent);
        } catch (e) {
            // If file doesn't exist or is invalid, we start with an empty array
        }
        const newData = existingData.concat(data);
        await writeFile(filename, JSON.stringify(newData, null, 2));
    } catch (error) {
        console.error("Error writing to file:", error);
    }
}

const realBrowserOption = {
    args: ["--start-maximized", "--window-size=1200,1300"],
    turnstile: true,
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};

async function testScraper() {
    console.log("Starting scraper...");
    const { browser, page } = await connect(realBrowserOption);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (typeof page.route !== "function") {
        console.log("Re-enabling page.route...");
        await page._client().send("Fetch.enable", {
            patterns: [{ requestStage: "Request" }], // Intercept all requests
        });

        page.route = async (urlPattern, handler) => {
            page._client().on("Fetch.requestPaused", async (event) => {
                const requestUrl = event.request.url;

                // Match the URL pattern
                const shouldHandle =
                    urlPattern === "**/*" || new RegExp(urlPattern).test(requestUrl);

                const fakeRequest = {
                    url: requestUrl,
                    method: event.request.method,
                    resourceType: event.resourceType || "other",
                    headers: event.request.headers,
                };

                const fakeRoute = {
                    abort: async () =>
                        await page._client().send("Fetch.failRequest", {
                            requestId: event.requestId,
                            errorReason: "Failed",
                        }),
                    continue: async () =>
                        await page._client().send("Fetch.continueRequest", {
                            requestId: event.requestId,
                        }),
                    request: () => fakeRequest,
                };

                if (shouldHandle) {
                    await handler(fakeRoute);
                } else {
                    await fakeRoute.continue();
                }
            });
        };
    }

    try {
        // Set up page.route to block unwanted resources
        await page.route("**/*", async (route) => {
            try {
                const request = route.request();
                const resourceType = request.resourceType;
                const url = request.url;

                console.log(`Resource type: ${resourceType}`);


                // Block resources based on type or URL patterns
                if (
                    resourceType === "Image" || // Block images
                    resourceType === "Media" || // Block media
                    resourceType === "Font" || // Block fonts
                    resourceType === "stylesheet" || // Block CSS
                    url.includes("google-analytics") || // Block Google Analytics
                    url.includes("doubleclick.net") || // Block DoubleClick ads
                    url.includes("facebook.com/tr/") || // Block Facebook trackers
                    url.includes("fundingchoicesmessages.google.com") // Block Funding Choices
                ) {
                    console.log(`Blocking ${resourceType} request: ${url}`);
                    await route.abort(); // Block the request
                } else {
                    // Allow all other requests
                    console.log(`Allowing ${resourceType} request: ${url}`);
                    await route.continue(); // Continue the request
                }
            } catch (error) {
                // Fallback in case of errors
                console.error(`Error handling request: ${error.message}`);
                await route.continue(); // Ensure requests proceed in case of errors
            }
        });


        const webpageUrl = "https://grabjobs.co/canada/jobs-in-canada";
        const url = new URL(webpageUrl);
        const country = url.pathname.split("/")[1];
        const filename = `${country}_job_listings.json`;

        await page.goto(webpageUrl, { waitUntil: "networkidle0" });
        await delay(2000);

        while (true) {
            try {
                await page.waitForFunction(
                    () => document.querySelectorAll("a.link-card").length > 0,
                    { timeout: 10000 }
                );
            } catch (e) {
                console.log("No job listings found on page");
                break;
            }

            const currentUrl = await page.url();
            const currentPage = new URL(currentUrl).searchParams.get("p") || "1";

            const jobListings = await page.evaluate((pageNum) => {
                return Array.from(document.querySelectorAll("a.link-card")).map(
                    (card) => {
                        return {
                            title: card.querySelector("h2")?.textContent?.trim() || "",
                            company: card.querySelector("h3")?.textContent?.trim() || "",
                            location:
                                card
                                    .querySelector('img[alt="geo-alt icon"]')
                                    ?.closest("p")
                                    ?.querySelector("span")
                                    ?.textContent?.trim() || "",
                            jobType:
                                card
                                    .querySelector('img[alt="briefcase icon"]')
                                    ?.closest("p")
                                    ?.querySelector("span")
                                    ?.textContent?.trim() || "",
                            description:
                                card.querySelector(".break-words")?.textContent?.trim() || "",
                            jobUrl: card.href || "",
                            postedTime:
                                card
                                    .querySelector(".text-sm:last-child")
                                    ?.textContent?.trim() || "",
                            scrapedAt: new Date().toISOString(),
                            pageNumber: pageNum,
                        };
                    }
                );
            }, currentPage);

            await appendToFile(filename, jobListings);
            console.log(`Saved ${jobListings.length} jobs from page ${currentPage}`);

            const hasNextPage = await page.evaluate(() => {
                const nextButton = document.querySelector(
                    "a.rounded-e-md:not(.text-gray-400)"
                );
                if (nextButton) {
                    nextButton.click();
                    return true;
                }
                return false;
            });

            if (!hasNextPage) break;
            await delay(5000);
        }
    } catch (error) {
        console.error("Error during scraping:", error);
    } finally {
        await browser.close();
    }
}

testScraper();
