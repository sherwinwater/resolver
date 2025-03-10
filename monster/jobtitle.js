import { connect } from "puppeteer-real-browser";
import { writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file_name = join(__dirname, "monster_ca_job_listings.json");
const file_mission_name = join(__dirname, "missions.json");

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
    // console.log('Delaying for', randomTime, 'ms');
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
    const baseUrl = "https://www.monster.com/jobs/";
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
        let count_job_title = 0;
        // Process each job title.
        for (const jobTitleData of jobTitleElements) {
            count_job_title += 1;
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
            console.log(`--JobTitle ${count_job_title}: Found ${subJobTitleElements.length} sub job title elements in ${jobTitleHref}`);

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

        await appendToFile(file_mission_name, missions); // Append data after each mission.
        console.log(`Prepared ${missions.length} child missions in ${file_mission_name}\``);
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
        console.log(`---Processing mission: ${mission.startUrl}`);
        await page.goto(mission.startUrl, { waitUntil: 'networkidle0' });

        await delay(5000, 8000);
        // console.log(`---Delaying for after opening start page for ${mission.startUrl} `);

        // 1) Try closing cookie popup
        // const acceptCookiesSelector = '#onetrust-accept-btn-handler';
        // try {
        //     await page.waitForSelector(acceptCookiesSelector, { timeout: 5000 });
        //     await page.click(acceptCookiesSelector);
        //     console.log("Cookie popup clicked.");
        //     await page.waitForTimeout(2000);
        // } catch (error) {
        //     console.log("Cookie popup not found or couldn't be clicked within 5s. Continuing...");
        // }

        // 2) Scroll in increments until we find 'No More Results' button or reach a max iteration
        const noMoreResultsSelector = 'button[data-testid="svx-no-more-results-disabled-button"]';
        const maxScrolls = 50;  // Adjust this depending on how many times you want to attempt scrolling
        let hasNoMoreResultsButton = false;

        // console.log(`---Scrolling up to ${maxScrolls} times to load more job listings...`);

        for (let i = 0; i < maxScrolls; i++) {
            // Check if 'No More Results' exists
            const noMoreButton = await page.$(noMoreResultsSelector);
            if (noMoreButton) {
                // console.log("---Reached the end of the listings (No More Results button found).");
                hasNoMoreResultsButton = true;
                break;
            }

            // Scroll one viewport down
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });

            // Give the site time to load new content
            delay(1500, 3000);
            // console.log(`Scrolled ${i + 1} times.`);
        }

        // if (!hasNoMoreResultsButton) {
        //     console.log(
        //         "---Warning: 'No More Results' button not found within max scroll attempts. " +
        //         "Continuing with whatever data is loaded..."
        //     );
        // }else{
        //     console.log("---finished scrolling.");
        // }

        // 3) Extract all job listings
        const currentPage = new URL(await page.url()).searchParams.get('page') || '1';
        const jobListings = await page.evaluate((pageNum, source) => {
            return Array.from(document.querySelectorAll('[data-testid="JobCard"]')).map(card => ({
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

        // 4) For each listing, open the detail link in a new tab
        console.log(`---Found ${jobListings.length} job listings`);

        let count =0;

        // for (let job of jobListings) {
        //     count +=1
        //     if (job.jobUrl) {
        //         const detailPage = await browser.newPage();
        //         try {
        //             await detailPage.goto(job.jobUrl, { waitUntil: 'networkidle0' });
        //             console.log(`Opened detail page for ${job.jobUrl}`);
        //             console.log(`Delaying for after opening detail page for ${job.jobUrl} `);
        //             job.detailContent = await detailPage.content();
        //             job.detailContent = 'done';
        //             await delay(3000, 5000);
        //         } catch (err) {
        //             console.error(`Error fetching details for ${job.jobUrl}:`, err);
        //             job.detailContent = null;
        //         } finally {
        //             await detailPage.close();
        //         }
        //     }
        //
        //     if (count % 7 === 0) {
        //         await delay(30000, 50000);
        //     }
        // }

        // console.log(`---Mission ${mission.startUrl}: Collected ${jobListings.length} job listings with details.`);
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
    const missionLimit = process.env.CHILD_MISSION_LIMIT ? parseInt(process.env.CHILD_MISSION_LIMIT) : 10000;

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
        // const missionResults = await Promise.all(missions.map(mission => processChildMission(browser, mission)));
        // const allJobs = missionResults.flat();

        let allJobs = [];
        let mission_count = 0;
        for (const mission of missions) {
            mission_count += 1;
            console.log(`Processing mission ${mission_count}`);
            const missionResult = await processChildMission(browser, mission);
            await appendToFile(file_name, missionResult); // Append data after each mission.
            // console.log(`---Appended results of mission to ${file_name}`);
            await delay(30000, 50000);
            // console.log(`---Delaying for next mission`);
        }

        console.log(`Saved a total of ${allJobs.length} job listings to ${file_name}`);
    } catch (error) {
        console.error('Error during main execution:', error);
    } finally {
        await browser.close();
    }
}

// ... [Keep your existing imports and helper functions here] ...

/**
 * Processes missions in batches concurrently.
 * @param {object} browser - The connected Puppeteer browser instance.
 * @param {Array} missions - Array of child mission objects.
 * @param {number} batchSize - Number of missions to process in parallel.
 */
async function processMissionsInBatches(browser, missions, batchSize = 10) {
    for (let i = 100; i < missions.length; i += batchSize) {
      const batch = missions.slice(i, i + batchSize);
      console.log(`Processing batch: missions ${i + 1} to ${i + batch.length}`);
  
      // Run the missions concurrently for the current batch.
      const batchResults = await Promise.all(
        batch.map((mission) => processChildMission(browser, mission))
      );
  
      // Append each mission's results to the file.
      for (const missionResult of batchResults) {
        await appendToFile(file_name, missionResult);
      }
      
      // Optional delay after each batch before processing the next one.
      await delay(30000, 50000);
    }
  }
  
  /**
   * MAIN FUNCTION
   *
   * Connects to the browser, runs the prepare phase to obtain child missions,
   * and then processes each mission in parallel batches.
   */
  async function mainParallel() {
    // Configure mission limit from environment or default to 10000.
    const missionLimit = process.env.CHILD_MISSION_LIMIT ? parseInt(process.env.CHILD_MISSION_LIMIT) : 10000;
  
    const { browser } = await connect({
      headless: false,
      turnstile: true,
      args: [
        "--window-size=920,980"
      ]
    });
  
    try {
      // PREPARE: Get child missions using the specified workflow and XPath selectors.


      //const missions = await prepareChildMissions(browser, missionLimit);
      //console.log(`Prepared ${missions.length} child missions.`);

      // get mission data from file
        const fileContent = await fs.readFile(file_mission_name, 'utf8');
        const missions = JSON.parse(fileContent);
        console.log(`Read ${missions.length} child missions from ${missions}`);

      // PAYLOAD: Process missions in parallel batches (10 at a time).
      await processMissionsInBatches(browser, missions, 10);
  
      console.log(`Completed processing all missions.`);
    } catch (error) {
      console.error('Error during main execution:', error);
    } finally {
      await browser.close();
    }
  }

mainParallel();
