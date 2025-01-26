const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false }); // Set headless to true for non-UI
    const page = await browser.newPage();

    // Navigate to the target page
    await page.goto('https://www.alodokter.com'); // Replace with your URL

    // Wait for the shadow host element
    await page.waitForSelector('home-banner#heroView'); // The shadow host selector

    // Fetch content from `.hero` class inside the shadow DOM
    const heroContent = await page.evaluateHandle(() => {
        // Find the shadow host element
        const shadowHost = document.querySelector('home-banner#heroView');

        // Get the shadow root
        const shadowRoot = shadowHost.shadowRoot;

        // Get the `.hero` element inside the shadow root
        const heroElement = shadowRoot.querySelector('.hero');

        // Extract and return the HTML content
        return heroElement ? heroElement.innerHTML : null;
    });

    // Resolve the content
    const heroHTML = await heroContent.jsonValue();

    console.log('Content of `.hero`:', heroHTML);

    // Close the browser
    await browser.close();
})();
