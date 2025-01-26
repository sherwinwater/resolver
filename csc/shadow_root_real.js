const { connect } = require('puppeteer-real-browser');

const realBrowserOption = {
    args: ["--start-maximized"],
    turnstile: true,
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};


(async () => {

    const { browser, page } = await connect(realBrowserOption);

    // Navigate to the page
    await page.goto('https://csc.gov.ph/career/job/4295201', { waitUntil: 'networkidle2' });

    try {
        // Access the shadow root and fetch the PDF URL
        const pdfUrl = await page.evaluate(() => {
            // Select the outer shadow host
            const shadowHost = document.querySelector('pdf-viewer#viewer');
            if (!shadowHost || !shadowHost.shadowRoot) return 'Shadow host not found';

            // Access the main shadow root
            const shadowRoot = shadowHost.shadowRoot;

            // Select the embed element
            const embedElement = shadowRoot.querySelector('embed#plugin');
            if (!embedElement) return 'Embed element not found';

            // Extract the PDF URL
            return embedElement.getAttribute('original-url') || embedElement.getAttribute('src');
        });

        if (pdfUrl) {
            console.log('PDF URL:', pdfUrl);
        } else {
            console.error('Failed to fetch PDF URL. Element might be missing.');
        }
    } catch (error) {
        console.error('Error accessing shadow root:', error);
    }

    await browser.close();
})();
