import { connect } from "puppeteer-real-browser";
import { writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file_name = join(__dirname, "monster_ca_job_listings.json");

console.log('File name:', file_name);
// async function createFile() {
//     try {
//         await writeFile(file_name, JSON.stringify([])); // Initializes the file with an empty array
//         console.log('File created successfully');
//     } catch (err) {
//         console.error('Error creating file:', err);
//     }
// }
//
// createFile().catch(console.error);

// Utility: append data to a JSON file.
async function appendToFile(filename = file_name, data) {
    try {
        let existingData = [];
        try {
            await access(filename);
            const fileContent = await readFile(filename, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (e) {
            // File doesn't exist yet; start with an empty array.
        }
        const newData = existingData.concat(data);
        await writeFile(filename, JSON.stringify(newData, null, 2));
    } catch (error) {
        console.error('Error writing to file:', error);
    }
}

// Utility: Randomized delay.
function delay(min, max = 8000) {
    const randomTime = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log('Delaying for', randomTime, 'ms');
    return new Promise(resolve => setTimeout(resolve, randomTime));
}

/**
 * Helper function: Evaluate an XPath expression on the page.
 * Returns an array of objects with the properties you require (e.g. href and innerText).
 */
async function evaluateXPath(page, xpath) {
    return await page.evaluate((xpath) => {
        const result = [];
        const snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < snapshot.snapshotLength; i++) {
            const node = snapshot.snapshotItem(i);
            result.push({
                href: node.href || null,
                innerText: node.innerText ? node.innerText.trim() : ''
            });
        }
        return result;
    }, xpath);
}

/**
 * PREPARE PHASE
 *
 * Workflow:
 * 1. Navigate to the baseUrl ("https://www.monster.ca/jobs/").
 * 2. Extract job title elements using the provided XPath.
 * 3. For each job title, open its href in a new tab and wait for the page to load.
 * 4. Extract sub job title elements using the provided sub XPath.
 * 5. Create child mission objects using the extracted data.
 *
 * The function limits the number of child missions based on missionLimit.
 */
async function prepareChildMissions(browser, missionLimit = 100) {
    const baseUrl = "https://www.monster.ca/jobs/";
    const page = await browser.newPage();
    try {
        await page.goto(baseUrl, { waitUntil: 'networkidle0' });
        // Delay as per options.
        await delay(8000, 8000);

        // Step 1: Extract jobTitles using the XPath from your workflow.
        const jobTitleXPath = "//div[contains(@class, 'browse-jobs-list__list')]//ul[contains(@class, 'item-list--browse-jobs item-list--browse-jobs--job-titles')]//li/a";
        const jobTitleElements = await evaluateXPath(page, jobTitleXPath);
        console.log(`Found ${jobTitleElements.length} job title elements.`);

        let missions = [];
        // Process each job title.
        for (const jobTitleData of jobTitleElements) {
            const jobTitleHref = jobTitleData.href;
            if (!jobTitleHref) continue;

            // Step 2: Open the job title link in a new tab (simulate loadJobTitle).
            const newTab = await browser.newPage();
            await newTab.goto(jobTitleHref, { waitUntil: 'networkidle0' });
            await delay(8000, 8000);

            // Step 3: Extract sub job title elements using the provided XPath.
            const subJobTitleXPath = "//div[contains(@class, 'browse-jobs-list__list')]//ul/li/a";
            try {
                // Wait for the sub job titles to appear.
                await newTab.waitForSelector('xpath/' + subJobTitleXPath, { timeout: 8000 });
            } catch (e) {
                console.error(`Timeout waiting for sub job titles in ${jobTitleHref}`);
                await newTab.close();
                continue;
            }
            // Additional delay.
            await delay(2000, 2000);

            // Use our helper to extract sub job title data.
            const subJobTitleElements = await evaluateXPath(newTab, subJobTitleXPath);
            console.log(`Found ${subJobTitleElements.length} sub job title elements in ${jobTitleHref}`);

            // Step 4: Create child missions from the sub job title elements.
            for (const subElemData of subJobTitleElements) {
                const mission = {
                    initial_link_location: subElemData.innerText,
                    startUrl: subElemData.href
                };
                if (mission.startUrl) {
                    missions.push(mission);
                }
                if (missionLimit && missions.length >= missionLimit) break;
            }
            await newTab.close();
            if (missionLimit && missions.length >= missionLimit) break;
        }
        console.log(`Prepared ${missions.length} child missions.`);
        return missions;
    } catch (error) {
        console.error('Error during prepareChildMissions:', error);
        return [];
    } finally {
        await page.close();
    }
}

/**
 * PAYLOAD PHASE
 *
 * Processes a single child mission by:
 * - Navigating to the mission's startUrl.
 * - Paginating through job listing pages.
 * - Extracting job details.
 */
async function processChildMission(browser, mission) {
    const page = await browser.newPage();
    try {
        console.log(`Processing mission: ${mission.startUrl}`);

        await page.goto(mission.startUrl, { waitUntil: 'networkidle0' });

        // Initial delay to ensure everything has a chance to load
        await delay(5000, 8000);

        // 1) Try to handle the cookie popup via standard click
        // const acceptCookiesSelector = '#onetrust-accept-btn-handler';
        // try {
        //     await page.waitForSelector(acceptCookiesSelector, { timeout: 5000 });
        //     console.log('Cookie popup button found. Attempting to click...');
        //     await page.$eval(acceptCookiesSelector, (btn) => btn.click());
        //     await page.waitForTimeout(3000);
        //     console.log('Cookie popup clicked.');
        // } catch (error) {
        //     console.log('Cookie popup not found or click did not succeed within timeout. Attempting to remove it forcibly...');
        //     try {
        //         // 2) As a fallback, forcibly remove the cookie banner overlay
        //         await page.evaluate(() => {
        //             const cookieBanner = document.querySelector('#onetrust-consent-sdk');
        //             if (cookieBanner) {
        //                 cookieBanner.remove();
        //                 console.log('Forcibly removed cookie banner from DOM.');
        //             }
        //         });
        //         await page.waitForTimeout(2000);
        //     } catch (removalError) {
        //         console.log('Could not forcibly remove cookie banner. Proceeding anyway...');
        //     }
        // }

        // 3) Scroll until "No More Results" button is visible
        const noMoreResultsSelector = 'button[data-testid="svx-no-more-results-disabled-button"]';
        console.log('Scrolling down until we find "No More Results" button...');
        await page.evaluate(async (selector) => {
            function elementVisible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return !(rect.bottom < 0 || rect.top > window.innerHeight);
            }

            // Polling approach
            while (!document.querySelector(selector)) {
                window.scrollBy(0, window.innerHeight);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            // Once we find the button, ensure it’s actually in view
            const button = document.querySelector(selector);
            while (!elementVisible(button)) {
                button.scrollIntoView({ behavior: 'smooth' });
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }, noMoreResultsSelector);

        console.log('Reached the end of the listings (No More Results button found).');

        // 4) Extract all job listings
        const currentPage = new URL(await page.url()).searchParams.get('page') || '1';
        const jobListings = await page.evaluate((pageNum, source) => {
            return Array.from(document.querySelectorAll('[data-testid="JobCard"]')).map((card) => ({
                title: card.querySelector('[data-testid="jobTitle"]')?.textContent?.trim() || '',
                company: card.querySelector('[data-testid="company"]')?.textContent?.trim() || '',
                location: card.querySelector('[data-testid="jobDetailLocation"]')?.textContent?.trim() || '',
                postedTime: card.querySelector('[data-testid="jobDetailDateRecency"]')?.textContent?.trim() || '',
                jobUrl: card.querySelector('[data-testid="jobTitle"]')?.href || '',
                scrapedAt: new Date().toISOString(),
                pageNumber: pageNum,
                source: source
            }));
        }, currentPage, mission.initial_link_location);

        // 5) For each job listing, open detail link in a new tab and fetch page content
        console.log(`Found ${jobListings.length} job listings on page ${currentPage}. Fetching details...`);

        for (let job of jobListings) {
            if (job.jobUrl) {
                const detailPage = await browser.newPage();
                try {
                    await detailPage.goto(job.jobUrl, { waitUntil: 'networkidle0' });
                    await delay(3000, 5000);
                    job.detailContent = await detailPage.content();
                } catch (err) {
                    console.error(`Error fetching details for ${job.jobUrl}:`, err);
                    job.detailContent = null;
                } finally {
                    await detailPage.close();
                }
            }
        }

        console.log(`Mission ${mission.startUrl}: Collected ${jobListings.length} job listings with details.`);
        return jobListings;

    } catch (error) {
        console.error(`Error processing mission ${mission.startUrl}:`, error);
        return [];
    } finally {
        await page.close();
    }
}

/**
 * MAIN FUNCTION
 *
 * Connects to the browser, runs the prepare phase to obtain child missions,
 * and then processes each mission concurrently in the payload phase.
 */
async function main() {
    // Configure mission limit from environment or default to 100.
    const missionLimit = process.env.CHILD_MISSION_LIMIT ? parseInt(process.env.CHILD_MISSION_LIMIT) : 3;

    const { browser } = await connect({
        headless: false,
        turnstile: true,
        args: [
            "--window-size=920,980"
        ]
    });

    try {
        // PREPARE: Get child missions using the specified workflow and XPath selectors.
        const missions = await prepareChildMissions(browser, missionLimit);
        console.log(`Prepared ${missions.length} child missions.`);

        // PAYLOAD: Process each child mission concurrently.
        const missionResults = await Promise.all(missions.map(mission => processChildMission(browser, mission)));
        const allJobs = missionResults.flat();

        await appendToFile(file_name,allJobs);
        console.log(`Saved a total of ${allJobs.length} job listings to ${file_name}`);
    } catch (error) {
        console.error('Error during main execution:', error);
    } finally {
        await browser.close();
    }
}

main();
