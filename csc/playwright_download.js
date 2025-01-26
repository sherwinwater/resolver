const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // Launch the browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable request interception
    await page.route('**/*', async (route) => {
        const request = route.request();
        // Check if the request is for a PDF file
        if (request.resourceType() === 'document') {
            const response = await route.continue();
            const buffer = await response.body();
            // Define the path to save the PDF
            const filePath = path.join(__dirname, 'downloaded_file.pdf');
            // Save the PDF to the file system
            fs.writeFileSync(filePath, buffer);
            console.log(`PDF downloaded and saved to: ${filePath}`);
        } else {
            route.continue();
        }
    });

    // Navigate to the page that triggers the PDF download
    await page.goto('https://csc.gov.ph/career/job/4295201');

    // Perform actions that would trigger the PDF download
    // For example, clicking a button or link that initiates the download
    // await page.click('selector-for-download-button');

    // Wait for a short duration to ensure the download is captured
    await page.waitForTimeout(5000);

    // Close the browser
    await browser.close();
})();
