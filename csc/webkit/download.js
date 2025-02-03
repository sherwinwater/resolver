const { webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // Launch WebKit browser
    const browser = await webkit.launch({ headless: false });
    const context = await browser.newContext({
        acceptDownloads: true, // Enable accepting downloads
    });
    const page = await context.newPage();

    // Intercept requests to modify headers for PDF files
    // await page.route('**/*', async (route, request) => {
    //     if (request.resourceType() === 'document' && request.url().endsWith('.pdf')) {
    //         const response = await page.request.fetch(request);
    //         const headers = {
    //             ...response.headers(),
    //             'Content-Disposition': 'attachment',
    //         };
    //         await route.fulfill({npx playwright install webkit
    //             response,
    //             headers,
    //         });
    //     } else {
    //         await route.continue();
    //     }
    // });

    // Listen for download events
    page.on('download', async (download) => {
        const downloadPath = path.join(__dirname, download.suggestedFilename());
        await download.saveAs(downloadPath);
        console.log(`Downloaded file saved to: ${downloadPath}`);
    });

    const url = 'https://csc.gov.ph/career/job/4295201';

    try {
        await page.goto(url);
    } catch (error) {
        if (error.message.includes('Download is starting')) {
            console.log('Download initiated, handling download...');
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }

    await page.waitForTimeout(2000); // Adjust the timeout as needed

    await browser.close();
})();
