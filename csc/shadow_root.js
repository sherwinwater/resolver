const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        browser: 'chrome', // WebDriver BiDi is used by default.
        headless: false
    });
    const page = await browser.newPage();

    // Navigate to the page
    await page.goto('https://csc.gov.ph/career/job/4295201', {waitUntil: 'networkidle2'});

    try {
        // Wait for the external script to load
        await page.waitForResponse((response) =>
            response.url().includes('pdf_viewer_wrapper.js') && response.status() === 200
        );
        console.log('External script loaded!');

        // Wait for the `pdf-viewer#viewer` element to be present in the DOM
        await page.waitForSelector('pdf-viewer#viewer', {visible: true, timeout: 60000});
        console.log('pdf-viewer element found!');

        // Define a function to poll for the embed element within the shadow DOM
        const getPdfUrl = await page.evaluate(async () => {
            const shadowHost = document.querySelector('pdf-viewer#viewer');
            if (!shadowHost) return null;

            // Function to poll for the embed element
            const pollForEmbed = () => {
                return new Promise((resolve) => {
                    const interval = setInterval(() => {
                        const embedElement = shadowHost.shadowRoot?.querySelector('embed#plugin');
                        if (embedElement) {
                            clearInterval(interval);
                            resolve(embedElement.getAttribute('original-url') || embedElement.getAttribute('src'));
                        }
                    }, 100); // Poll every 100ms
                });
            };

            // Set a timeout for the polling
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60000));

            // Race between polling and timeout
            return Promise.race([pollForEmbed(), timeout]);
        });

        if (getPdfUrl) {
            console.log('PDF URL:', getPdfUrl);
        } else {
            console.error('Failed to fetch PDF URL. Embed element might be missing.');
        }
    } catch (error) {
        console.error('Error accessing shadow DOM:', error);
    }

    await browser.close();
})();
