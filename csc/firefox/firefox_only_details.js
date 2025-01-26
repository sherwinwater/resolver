const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        browser: 'firefox',
        headless: true, // Set to true if you don't want to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigate to the page
    await page.goto('https://csc.gov.ph/career/job/4295201', { waitUntil: 'networkidle2' });

    // Wait for the #viewer element and ensure the textLayer is loaded
    await page.waitForSelector('#viewer .textLayer');

    // Extract content from the textLayer
    const content = await page.evaluate(() => {
        const textLayerElements = document.querySelectorAll('#viewer .textLayer span');
        return Array.from(textLayerElements).map(span => span.innerText).join(' ');
    });

    console.log('Extracted Content:', content);

    await browser.close();
})();
