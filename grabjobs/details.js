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
    args: ["--window-size=1300,768"],
    turnstile: true,
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};

async function getJobDetails(browser, jobUrl) {
    // If the site blocks opening pages in new tabs from the same session,
    // you could use the same `page` instead, but that often complicates
    // returning to the listing. A new page is often easier.
    const detailPage = await browser.newPage();

    try {
        await detailPage.goto(jobUrl, { waitUntil: "networkidle0" });

        // Wait a bit in case there's dynamic content
        await new Promise((r) => setTimeout(r, 1500));

        const details = await detailPage.evaluate(() => {
            // Basic text-based extraction
            const jobDescriptionEl = document.querySelector("#job-description");
            const jobDescription = jobDescriptionEl?.innerText.trim() || "";

            // Attempt to find a salary line from the job description text:
            // e.g. "Hourly wage: CAD 22.76 $"
            // This example uses a simple regex to capture everything after "Hourly wage:"
            let salary = "";
            const salaryRegex = /Hourly wage\s*:\s*([^\n]+)/i;
            const match = jobDescription.match(salaryRegex);
            if (match) {
                salary = match[1].trim();
            }

            // Return anything else you want from the detail page:
            // e.g., job title or any structured field. We'll show an example:
            const detailTitle =
                document.querySelector(".job-detail-container h1")?.textContent.trim() ||
                "";

            return {
                detailTitle,
                jobDescription,
                salary,
            };
        });

        return details;
    } catch (err) {
        console.error("Error fetching job details:", err);
        return {
            detailTitle: "",
            jobDescription: "",
            salary: "",
        };
    } finally {
        await detailPage.close();
    }
}

async function testScraper() {
    console.log("Starting scraper...");
    const { browser, page } = await connect(realBrowserOption);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
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

            // Get minimal info from listing
            let jobListings = await page.evaluate((pageNum) => {
                return Array.from(document.querySelectorAll("a.link-card")).map((card) => {
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
                        shortDescription:
                            card.querySelector(".break-words")?.textContent?.trim() || "",
                        jobUrl: card.href || "",
                        postedTime:
                            card.querySelector(".text-sm:last-child")?.textContent?.trim() ||
                            "",
                        scrapedAt: new Date().toISOString(),
                        pageNumber: pageNum,
                    };
                });
            }, currentPage);

            console.log(`Found ${jobListings.length} job listings on page ${currentPage}`);

            // For each job listing, open detail page & fetch more data
            for (let job of jobListings) {
                if (job.jobUrl) {
                    console.log(`Navigating to detail page: ${job.jobUrl}`);
                    const details = await getJobDetails(browser, job.jobUrl);

                    // Merge the details into the job object
                    job.detailTitle = details.detailTitle;
                    job.fullDescription = details.jobDescription;
                    job.salary = details.salary;

                    // Brief delay to reduce load on site
                    await delay(1000);
                }
            }

            // Write job listings (with detail info) to file
            await appendToFile(filename, jobListings);
            console.log(`Saved ${jobListings.length} jobs from page ${currentPage}`);

            // Move to next page if possible
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
