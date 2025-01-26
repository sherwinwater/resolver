const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to the page
    await page.goto('https://csc.gov.ph/career/job/4295201', { waitUntil: 'networkidle' });

    try {
        // Wait for the shadow host to appear
        await page.waitForSelector('pdf-viewer#viewer');

        // Access the shadow DOM and interact with elements
        const pdfUrl = await page.evaluate(() => {
            const shadowHost = document.querySelector('pdf-viewer#viewer');
            const shadowRoot = shadowHost.shadowRoot;
            const embedElement = shadowRoot.querySelector('embed#plugin');
            return embedElement ? embedElement.getAttribute('original-url') || embedElement.getAttribute('src') : null;
        });

        if (pdfUrl) {
            console.log('PDF URL:', pdfUrl);
        } else {
            console.error('Failed to fetch PDF URL. Embed element might be missing.');
        }
    } catch (error) {
        console.error('Error accessing shadow DOM:', error);
    } finally {
        await browser.close();
    }
})();