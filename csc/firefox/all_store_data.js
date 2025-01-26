const puppeteer = require('puppeteer');
const fs = require('fs');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    // Initialize file
    const fileName = 'csc_job_data.txt';
    fs.writeFileSync(fileName, ''); // Clear file content at the start

    const browser = await puppeteer.launch({
        browser: 'firefox',
        headless: true, // Set to true if you don't want to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    // Open a new page
    const page = await browser.newPage();

    // Set the viewport
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // Navigate to the listing page
        const listingPageURL = 'https://csc.gov.ph/career/';
        await page.goto(listingPageURL, { waitUntil: 'networkidle2' });
        await delay(12000);

        // Extract job details from the listing table
        const jobs = await page.evaluate(() => {
            const rows = document.querySelectorAll('tbody tr');
            return Array.from(rows).map(row => {
                const columns = row.querySelectorAll('td');
                const detailsButton = row.querySelector('button.btn-primary');
                return {
                    agency: columns[0]?.innerText.trim() || '',
                    region: columns[1]?.innerText.trim() || '',
                    title: columns[2]?.innerText.trim() || '',
                    jobId: columns[3]?.innerText.trim() || '',
                    postedDate: columns[4]?.innerText.trim() || '',
                    deadline: columns[5]?.innerText.trim() || '',
                    buttonId: detailsButton?.id || '',
                };
            });
        });

        console.log('Jobs Found:', jobs);

        for (const job of jobs) {
            if (!job.buttonId) {
                console.log(`Skipping job with missing details button: ${JSON.stringify(job)}`);
                continue;
            }

            console.log(`Processing job: ${job.title} (${job.jobId})`);

            try {
                // Add delay before clicking the "Details" button
                await delay(6000);

                // Click the "Details" button and wait for the new tab
                const [detailsPage] = await Promise.all([
                    new Promise(resolve => browser.once('targetcreated', async target => resolve(await target.page()))),
                    page.click(`#${job.buttonId}`),
                ]);

                if (!detailsPage) {
                    console.error(`Failed to open details page for job: ${job.title}`);
                    continue;
                }

                // Add delay before interacting with the new page
                await delay(5000);

                // Wait for the job details to load
                await detailsPage.waitForSelector('#viewer .textLayer', { timeout: 10000 });

                // Extract content from the job details page
                const jobContent = await detailsPage.evaluate(() => {
                    const textLayerElements = document.querySelectorAll('#viewer .textLayer span');
                    return Array.from(textLayerElements).map(span => span.innerText).join(' ');
                });

                console.log('Extracted Job Content:', jobContent);

                // Save data to file
                fs.appendFileSync(fileName, `\nAgency: ${job.agency}\nRegion: ${job.region}\nTitle: ${job.title}\nJob ID: ${job.jobId}\nPosted Date: ${job.postedDate}\nDeadline: ${job.deadline}\nContent:\n${jobContent}\n`);

                // Close the details page tab
                await detailsPage.close();
            } catch (error) {
                console.error(`Error processing job (${job.title}):`, error);
            }
        }
    } catch (error) {
        console.error('Error during scraping process:', error);
    } finally {
        // Close the browser
        await delay(2000);
        await browser.close();
    }
})();