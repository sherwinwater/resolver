const puppeteer = require('puppeteer');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({
        browser: 'firefox',
        headless: false, // Set to true if you don't want to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    // Open a new page
    const page = await browser.newPage();

    // Set the viewport to match the screen size
    const screenWidth = 1920; // Replace with your desired width
    const screenHeight = 1080; // Replace with your desired height
    await page.setViewport({ width: screenWidth, height: screenHeight });

    // Navigate to the listing page
    const listingPageURL = 'https://csc.gov.ph/career/';
    await page.goto(listingPageURL, { waitUntil: 'networkidle2' });

    // Add delay after navigation
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

        // Add delay before clicking the "Details" button
        await delay(6000);

        // Click the "Details" button to open the job details in a new tab
        const [detailsPage] = await Promise.all([
            new Promise(resolve =>
                browser.once('targetcreated', target => resolve(target.page()))
            ),
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

        // Add delay before closing the details page
        await delay(3000);

        // Close the details page tab
        await detailsPage.close();

        // Optional: Save the extracted data
        const fs = require('fs');
        fs.appendFileSync('job_data.txt', `\nAgency: ${job.agency}\nRegion: ${job.region}\nTitle: ${job.title}\nJob ID: ${job.jobId}\nPosted Date: ${job.postedDate}\nDeadline: ${job.deadline}\nContent:\n${jobContent}\n`);
    }

    // Add delay before closing the browser
    await delay(2000);

    await browser.close();
})();
