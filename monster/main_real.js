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
            '--window-size=1020x1280',
            '--hide-scrollbars',
            '--disable-notifications',
            '--disable-extensions',
            '--force-device-scale-factor=1',
            '--disable-blink-features=AutomationControlled',
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
        const webpageUrl = 'https://www.monster.ca/jobs/search?q=&where=canada&page=1';
        const url = new URL(webpageUrl);
        const country = url.pathname.split('/')[1];
        const filename = `${country}_job_listings.json`;

        await page.goto(webpageUrl, { waitUntil: 'networkidle0' });
        await delay(2000);

        while (true) {
            try {
                await page.waitForFunction(
                    () => document.querySelectorAll('[data-testid="JobCard"]').length > 0,
                    { timeout: 10000 }
                );
            } catch (e) {
                console.log('No job listings found on page');
                break;
            }

            const currentUrl = await page.url();
            const currentPage = new URL(currentUrl).searchParams.get('page') || '1';

            const jobListings = await page.evaluate((pageNum) => {
                return Array.from(document.querySelectorAll('[data-testid="JobCard"]')).map(card => ({
                    title: card.querySelector('[data-testid="jobTitle"]')?.textContent?.trim() || '',
                    company: card.querySelector('[data-testid="company"]')?.textContent?.trim() || '',
                    location: card.querySelector('[data-testid="jobDetailLocation"]')?.textContent?.trim() || '',
                    postedTime: card.querySelector('[data-testid="jobDetailDateRecency"]')?.textContent?.trim() || '',
                    jobUrl: card.querySelector('[data-testid="jobTitle"]')?.href || '',
                    scrapedAt: new Date().toISOString(),
                    pageNumber: pageNum,
                }));
            }, currentPage);

            await appendToFile(filename, jobListings);
            console.log(`Saved ${jobListings.length} jobs from page ${currentPage}`);

            const hasNextPage = await page.evaluate(() => {
                const loadMoreButton = document.querySelector('[data-testid="svx-load-more-button"]');
                if (loadMoreButton) {
                    loadMoreButton.click();
                    return true;
                }
                return false;
            });

            if (!hasNextPage) {
                console.log('No more pages to load');
                break;
            }

            await delay(5000); // Wait for the next page to load
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }

}

test();