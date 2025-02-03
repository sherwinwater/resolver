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
            // Start with empty array if no file
        }
        const newData = existingData.concat(data);
        await writeFile(filename, JSON.stringify(newData, null, 2));
    } catch (error) {
        console.error("Error writing to file:", error);
    }
}

const realBrowserOption = {
    args: [
        "--window-size=1300,768",
        "--disable-blink-features=AutomationControlled",
        "--disable-notifications",
        "--disable-popup-blocking",
        "--disable-web-security",
        "--lang=fr-FR",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    ],
    turnstile: true,
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};

async function getJobDetails(browser, jobUrl) {
    const detailPage = await browser.newPage();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
        await detailPage.goto(jobUrl, { waitUntil: "networkidle0" });
        await delay(1500);

        const details = await detailPage.evaluate(() => {
            const detailTitle = document.querySelector("h1")?.textContent.trim() || "";
            const jobDescriptionEl = document.querySelector(
                ".job-details, .job-description, #job-description"
            );
            const jobDescription = jobDescriptionEl?.innerText.trim() || "";

            let salary = "";
            const salaryRegex = /Hourly wage\s*:\s*([^\n]+)/i;
            const match = jobDescription.match(salaryRegex);
            if (match) {
                salary = match[1].trim();
            }

            return {
                detailTitle,
                jobDescription,
                salary,
            };
        });
        return details;
    } catch (err) {
        console.error("Error fetching job details:", err);
        return { detailTitle: "", jobDescription: "", salary: "" };
    } finally {
        await detailPage.close();
    }
}

async function testScraper() {
    console.log("Starting scraper...");
    const { browser, page } = await connect(realBrowserOption);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
        const webpageUrl = "https://emploi.lefigaro.fr/recherche/offres-emploi";
        const filename = "emploi.json";

        // Go to main URL
        await page.goto(webpageUrl, { waitUntil: "networkidle0" });
        await delay(3000);

        // Try to close or skip popup
        try {
            // Wait for popup container
            await page.waitForSelector("div.sc-sq9wn4-1.dHlmoX", { timeout: 7000 });
            // Use XPath to find the button with text 'Continuer sans accepter'
            const [skipButton] = await page.$x("//button[contains(., 'Continuer sans accepter')]");
            if (skipButton) {
                console.log("Clicking 'Continuer sans accepter'...");
                await skipButton.click();
                await delay(1000);
            } else {
                console.log("Could not find 'Continuer sans accepter' button via XPath");
            }
        } catch (e) {
            console.log("Popup not found or timed out:", e);
        }

        // Main scraping loop
        while (true) {
            // Wait for job cards
            try {
                await page.waitForSelector('div[data-v-69b26c0f] a.search-result-job-card', {
                    timeout: 10000,
                });
            } catch (e) {
                console.log("No job listings found on this page or timed out.");
                break;
            }

            const currentUrl = await page.url();
            const currentPage = new URL(currentUrl).searchParams.get("p") || "1";

            // Extract listing data
            const jobListings = await page.evaluate((pageNum) => {
                const cards = Array.from(
                    document.querySelectorAll('div[data-v-69b26c0f] a.search-result-job-card')
                );
                return cards.map((card) => {
                    const titleEl = card.querySelector(".search-result-job-card__title");
                    const companyEl = card.querySelector(".search-result-job-card__infos span");
                    const contractLocEl = card.querySelector(".search-result-job-card__contract-and-location");
                    const descEl = card.querySelector(".search-result-job-card__description span");
                    const publishedTimeEl = card.querySelector("time");

                    return {
                        title: titleEl?.textContent.trim() || "",
                        company: companyEl?.textContent.trim() || "",
                        contractAndLocation: contractLocEl?.innerText.trim() || "",
                        shortDescription: descEl?.textContent.trim() || "",
                        postedTime: publishedTimeEl?.innerText.trim() || "",
                        jobUrl: card.href || "",
                        scrapedAt: new Date().toISOString(),
                        pageNumber: pageNum,
                    };
                });
            }, currentPage);

            console.log(`Found ${jobListings.length} job listings on page ${currentPage}`);

            // For demonstration, only detail-fetch 2
            let maxJobsToFetch = 2;
            let fetchedCount = 0;
            for (let job of jobListings) {
                if (!job.jobUrl) continue;
                console.log(`Fetching details for: ${job.jobUrl}`);
                await delay(1000);

                const details = await getJobDetails(browser, job.jobUrl);
                Object.assign(job, {
                    detailTitle: details.detailTitle,
                    fullDescription: details.jobDescription,
                    salary: details.salary,
                });

                await delay(800);
                fetchedCount++;
                if (fetchedCount >= maxJobsToFetch) {
                    console.log(`Reached ${maxJobsToFetch} jobs. Stopping detail fetch for page ${currentPage}.`);
                    break;
                }
            }

            // Write to file
            await appendToFile(filename, jobListings);
            console.log(`Saved ${jobListings.length} jobs from page ${currentPage}`);

            // Check if next page button is present
            const hasNextPage = await page.evaluate(() => {
                const nextBtn = document.querySelector('button.pagination__nav-arrow:not([disabled])');
                return !!nextBtn;
            });

            if (!hasNextPage) {
                console.log("No more pages or next page button is disabled.");
                break;
            }

            // Instead of waitForNavigation, wait for new job cards
            console.log("Clicking next page button (SPA style)...");


            // 2) click next
            await page.click('button.pagination__nav-arrow:not([disabled])');

            // 1) get current card count
            const oldCardCount = await page.evaluate(() => {
                return document.querySelectorAll('div[data-v-69b26c0f] a.search-result-job-card').length;
            });

            // 3) wait for job card count to change
            try {
                await page.waitForFunction(
                    (selector, oldCount) => {
                        const newCount = document.querySelectorAll(selector).length;
                        return newCount > 0 && newCount !== oldCount;
                    },
                    { timeout: 15000 },
                    'div[data-v-69b26c0f] a.search-result-job-card',
                    oldCardCount
                );
            } catch (err) {
                console.error("Next page update timed out or didn't change job cards:", err);
                break;
            }

            // Extra delay
            await delay(2000);
        }
    } catch (error) {
        console.error("Error during scraping:", error);
    } finally {
        await browser.close();
    }
}

testScraper();
