const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // Launch Firefox browser
    const browser = await firefox.launch();
    const context = await browser.newContext({
        acceptDownloads: true, // Enable accepting downloads
    });
    const page = await context.newPage();

    page.on('download', async (download) => {
        const downloadPath = path.join(__dirname, download.suggestedFilename());
        await download.saveAs(downloadPath);
        console.log(`Downloaded file saved to: ${downloadPath}`);
    });

    // const url = 'https://ai.wharton.upenn.edu/wp-content/uploads/2024/11/AI-Report_Full-Report.pdf';
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

    await page.waitForTimeout(5000); // Adjust the timeout as needed

    await browser.close();
})();
