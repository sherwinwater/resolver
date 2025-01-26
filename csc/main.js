import PuppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';
import path from 'path';

(async () => {
    try {
        const downloadPath = path.resolve("./downloads"); // Define the download path

        const puppeteer = PuppeteerExtra;
        // Add stealth plugin to bypass bot detection
        puppeteer.use(StealthPlugin());
        // Add user preferences plugin to configure download behavior
        puppeteer.use(
            UserPreferencesPlugin({
                userPrefs: {
                    download: {
                        prompt_for_download: false, // Disable download prompts
                        open_pdf_in_system_reader: true, // Open PDFs in the system reader
                    },
                    plugins: {
                        always_open_pdf_externally: true, // Always open PDFs externally
                    },
                },
            })
        );
        console.log("Puppeteer Extra: Plugins enabled!");

        // Launch the browser
        const browser = await puppeteer.launch({
            headless: false, // Run in non-headless mode
        });

        const page = await browser.newPage();

        const url = 'https://csc.gov.ph/career/job/4302326'; // Replace with the target URL
        console.log("Navigating to page...");
        await page.goto(url, {
            waitUntil: ['domcontentloaded', 'networkidle0'], // Wait until the page is fully loaded
        });

        await page.waitForTimeout(1000); // Short delay to ensure stability
        console.log("At page");

        // Set up download behavior
        await page._client().send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: downloadPath, // Set the download directory
        });
        console.log(`Download behavior set. Files will be downloaded to: ${downloadPath}`);


        await page.waitForTimeout(3000); // Wait for the download to complete
        console.log("Waiting for download to complete...");

        // Close the browser
        await browser.close();
        console.log("Browser closed");
    } catch (error) {
        console.error("An error occurred:", error.message);
    }
})();
