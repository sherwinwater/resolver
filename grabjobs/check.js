const { connect } = require("puppeteer-real-browser");

async function testScraper() {
    const { browser, page } = await connect({
        args: ["--start-maximized"],
        headless: false,
    });

    // Restore `page.route` using Puppeteer's CDP (Chrome DevTools Protocol)
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
        // Use `page.route` to filter out media, CSS, etc.
        await page.route("**/*", (route) => {
            const resourceType = route.request().resourceType;
            if (
                resourceType === "image" ||
                resourceType === "media" ||
                resourceType === "stylesheet" ||
                resourceType === "font"
            ) {
                console.log(`Blocking resource: ${route.request().url}`);
                route.abort(); // Block unwanted resources
            } else {
                route.continue(); // Allow other resources
            }
        });

        await page.goto("https://example.com", { waitUntil: "networkidle0" });
        console.log("Page loaded successfully.");
    } catch (error) {
        console.error("Error during scraping:", error);
    } finally {
        await browser.close();
    }
}

testScraper();
