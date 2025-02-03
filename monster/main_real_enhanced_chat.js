import { connect } from "puppeteer-real-browser";
import { writeFile, readFile, access } from 'fs/promises';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Helper functions
const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

// User Agent Rotator
const userAgents = shuffleArray([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
]);

let pageCount = 0;

async function progressiveDelay() {
    const baseDelay = randomInRange(3000, 8000);
    const progressiveFactor = Math.min(2, 1 + (pageCount * 0.07));
    const finalDelay = baseDelay * progressiveFactor;

    if (pageCount % 7 === 0) {
        const longPause = randomInRange(15000, 45000);
        console.log(`[ANTI-BOT] Long pause: ${Math.round(longPause/1000)}s`);
        await new Promise(resolve => setTimeout(resolve, longPause));
    }

    console.log(`[DELAY] Waiting ${Math.round(finalDelay/1000)}s`);
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

async function humanInteraction(page) {
    // Random mouse movement pattern
    await page.mouse.move(
        randomInRange(100, 500),
        randomInRange(100, 500),
        { steps: randomInRange(5, 15) }
    );

    // Random scroll pattern
    await page.evaluate(async () => {
        window.scrollBy({
            top: randomInRange(-300, 500),
            left: 0,
            behavior: 'smooth'
        });
    });
}

async function safeClick(page, selector) {
    await page.waitForSelector(selector, { visible: true, timeout: 10000 });
    await humanInteraction(page);
    const element = await page.$(selector);
    await element.click();
    await progressiveDelay();
}

async function scrapePage(page, currentPage) {
    await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="JobCard"]').length > 0,
        { timeout: 15000 }
    );

    const jobData = await page.evaluate((pageNum) => {
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

    return jobData;
}

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

async function main() {
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            `--user-agent=${userAgents[pageCount % userAgents.length]}`
        ],
        plugins: [
            import('puppeteer-extra-plugin-click-and-wait'),
            StealthPlugin()
        ],
        connectOption: {
            defaultViewport: null,
            ignoreHTTPSErrors: true
        }
    });

    try {
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
        });

        await page.goto('https://www.monster.ca/jobs/search?q=&where=canada&page=1', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        const filename = 'canada_job_listings.json';

        while (true) {
            pageCount++;

            try {
                const currentUrl = await page.url();
                const currentPage = new URL(currentUrl).searchParams.get('page') || '1';

                const jobListings = await scrapePage(page, currentPage);
                await appendToFile(filename, jobListings);
                console.log(`Saved ${jobListings.length} jobs from page ${currentPage}`);

                // Rotate user agent every 5 pages
                if (pageCount % 5 === 0 && userAgents.length > 1) {
                    await page.setUserAgent(userAgents[pageCount % userAgents.length]);
                }

                const nextPageExists = await page.evaluate(() => {
                    return document.querySelector('[data-testid="svx-load-more-button"]') !== null;
                });

                if (!nextPageExists) break;

                await humanInteraction(page);
                await safeClick(page, '[data-testid="svx-load-more-button"]');
                await progressiveDelay();

                // Reset counter after 25 pages
                if (pageCount >= 25) {
                    console.log('[ANTI-BOT] Restarting browser session');
                    await browser.close();
                    return main(); // Recursive restart
                }

            } catch (error) {
                console.error(`[ERROR] Page ${pageCount}:`, error.message);
                await page.screenshot({ path: `error-${Date.now()}.png` });
                break;
            }
        }
    } finally {
        await browser.close();
    }
}

// Start with random initial delay
setTimeout(main, randomInRange(3000, 10000));