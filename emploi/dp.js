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
    args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-web-security'
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
    try {
        await detailPage.goto(jobUrl, { waitUntil: "networkidle0", timeout: 60000 });
        // await detailPage.waitForSelector('[data-v-69b26c0f]', { timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

        const details = await detailPage.evaluate(() => {
            const extractFromSelector = (selector) =>
                document.querySelector(selector)?.innerText?.trim() || '';

            return {
                detailTitle: extractFromSelector('h1[data-v-69b26c0f]'),
                jobDescription: extractFromSelector('[data-v-69b26c0f] .job-description'),
                salary: extractFromSelector('[data-v-69b26c0f] .salary-info'),
                requirements: extractFromSelector('[data-v-69b26c0f] .requirements-section')
            };
        });

        return details;
    } catch (err) {
        console.error("Error fetching job details:", err);
        return {};
    } finally {
        await detailPage.close();
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
    }
}

async function testScraper() {
    console.log("Starting scraper...");
    const { browser, page } = await connect(realBrowserOption);
    const randomDelay = () => new Promise(r => setTimeout(r, 5500 + Math.random() * 2000));
    const filename = "emploi.json"; // Fixed filename

    try {
        await page.goto("https://emploi.lefigaro.fr/recherche/offres-emploi", {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        let pageNumber = 1;
        while (true) {
            await randomDelay();

            // Wait for job cards with data-v-69b26c0f attribute
            await page.waitForSelector('[data-v-69b26c0f] .search-result-job-card', {
                timeout: 15000
            });

            const jobListings = await page.evaluate((pageNum) => {
                return Array.from(
                    document.querySelectorAll('[data-v-69b26c0f] .search-result-job-card')
                ).map(card => {
                    const link = card.href;
                    const title = card.querySelector('.search-result-job-card__title')?.textContent;
                    const company = card.querySelector('.search-result-job-card__infos span')?.textContent;

                    return {
                        title: title?.replace(/Nouveau/g, '')?.trim() || '',
                        company: company?.trim() || '',
                        location: Array.from(card.querySelectorAll('.dot'))
                            .find(el => el.textContent.includes('Publié'))
                            ?.previousElementSibling?.textContent?.trim() || '',
                        jobUrl: link,
                        scrapedAt: new Date().toISOString(),
                        pageNumber: pageNum
                    };
                });
            }, pageNumber);

            console.log(`Found ${jobListings.length} jobs on page ${pageNumber}`);

            // Process job details with randomized delays
            for (const [index, job] of jobListings.entries()) {
                if (job.jobUrl) {
                    await randomDelay();
                    try {
                        const details = await getJobDetails(browser, job.jobUrl);
                        Object.assign(job, details);
                        console.log(`Processed job ${index + 1}/${jobListings.length}`);
                    } catch (err) {
                        console.error(`Failed to process job ${index + 1}:`, err);
                    }
                }
            }

            await appendToFile(filename, jobListings);
            console.log(`Saved page ${pageNumber} results`);

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            });

// Disable WebDriver flag
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false
                });
            });

            // Handle pagination with bot-like behavior simulation
            const nextPageButton = await page.$('button.pagination__nav-arrow[aria-label="Aller à la page suivante"]');
            if (!nextPageButton) break;

            await nextPageButton.click();
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Random delay between page changes
            await new Promise(r => setTimeout(r, 7000 + Math.random() * 4000));
            pageNumber++;
        }
    } catch (error) {
        console.error("Scraping failed:", error);
    } finally {
        await browser.close();
    }
}

testScraper();