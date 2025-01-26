const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

(async () => {
    const browser = await firefox.launch({
        headless: false // Set to true for headless mode
    });

    const downloadPath = path.resolve(__dirname, 'downloads');
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
    }

    const context = await browser.newContext({
        acceptDownloads: true, // Enable download handling
    });
    const page = await context.newPage();

    try {
        // Listen for download events
        const [download] = await Promise.all([
            page.waitForEvent('download'), // Wait for a download event
            page.goto('https://csc.gov.ph/career/job/4295201', { waitUntil: 'load' ,timeout: 100000}) // Start navigation
        ]);

        // Save the downloaded file
        const pdfPath = path.join(downloadPath, download.suggestedFilename());
        console.log('Downloading to:', pdfPath);
        await download.saveAs(pdfPath);

        // Extract text from the downloaded PDF
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfParse(pdfBuffer);
        console.log('Extracted Content:', pdfData.text);
    } catch (error) {
        console.error('An error occurred:', error.message);
    } finally {
        await browser.close();
    }
})();
