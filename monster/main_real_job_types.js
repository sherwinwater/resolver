import { connect } from "puppeteer-real-browser";
import { writeFile, readFile, access } from 'fs/promises';

async function appendToFile(filename, data) {
    try {
        let existingData = [];
        try {
            await access(filename);
            const fileContent = await readFile(filename, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (e) {
            // File doesn't exist yet
        }
        const newData = existingData.concat(data);
        await writeFile(filename, JSON.stringify(newData, null, 2));
    } catch (error) {
        console.error('Error writing to file:', error);
    }
}

const isHeadless = false;
// const isHeadless = process.env.HEADLESS === 'true';

async function test() {
    console.log("start")
    const { browser, page } = await connect({
        headless: isHeadless,
        args: [
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1020x1380',
            '--hide-scrollbars',
            '--disable-notifications',
            '--disable-extensions',
            ...(isHeadless ? ['--display=' + process.env.DISPLAY] : [])
        ],
        customConfig: {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false
    });

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        // const startUrl = 'https://www.monster.ca/jobs/browse/l-alberta';
        const startUrl = 'https://www.monster.ca/jobs/q-aba-therapist-jobs'; // works to pass verification
        // const startUrl = 'https://www.monster.ca/jobs/c-dentalcorp?page=1'; // get capcha
        // const startUrl = 'https://www.monster.ca/jobs/c-aecom'; // get capcha
        const screenshotPath = 'screenshot.png';

        const filename = 'c-aecom_jobs.json';

        // Navigate to the starting URL
        await page.goto(startUrl, { waitUntil: 'networkidle0' });
        await page.screenshot({ path:  'screenshot_first.png', fullPage: true });
        await delay(5000);
        await page.screenshot({ path:  'screenshot_delayed.png', fullPage: true });
        console.log(`Screenshot saved as ${screenshotPath}`);

        while (true) {
            // Wait for job cards to load
            try {
                await page.waitForFunction(
                    () => document.querySelectorAll('[data-testid="JobCard"]').length > 0,
                    { timeout: 10000 }
                );
                await page.screenshot({ path:  'screenshot_waitforfunciton.png', fullPage: true });

            } catch (e) {
                await page.screenshot({ path:  'screenshot_catch_error.png', fullPage: true });

                console.log("No job cards found on the page.");
                break;
            }

            // Scrape job listings
            const jobListings = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[data-testid="JobCard"]')).map((card) => ({
                    title: card.querySelector('[data-testid="jobTitle"]')?.textContent?.trim() || '',
                    company: card.querySelector('[data-testid="company"]')?.textContent?.trim() || '',
                    location: card.querySelector('[data-testid="jobDetailLocation"]')?.textContent?.trim() || '',
                    postedTime: card.querySelector('[data-testid="jobDetailDateRecency"]')?.textContent?.trim() || '',
                    jobUrl: card.querySelector('[data-testid="jobTitle"]')?.href || '',
                    scrapedAt: new Date().toISOString(),
                }));
            });

            if (jobListings.length > 0) {
                await appendToFile(filename, jobListings);
                console.log(`Saved ${jobListings.length} jobs.`);
            } else {
                console.log("No jobs found on the page.");
                break;
            }

            // Check for the "Load More" button and click it
            const hasNextPage = await page.evaluate(() => {
                const loadMoreButton = document.querySelector('[data-testid="svx-load-more-button"]');
                if (loadMoreButton) {
                    loadMoreButton.click();
                    return true;
                }
                return false;
            });

            if (!hasNextPage) {
                console.log("No more pages available.");
                break;
            }

            // Wait for the next page to load
            await delay(5000);
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
}

test();