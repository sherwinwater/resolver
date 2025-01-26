import PuppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserPreferencesPlugin from 'puppeteer-extra-plugin-user-preferences';
import path from 'path';
import { connect } from 'puppeteer-real-browser';

(async () => {
    try {
        const { page, browser } = await connect({
            args: ["--start-maximized"], // Start browser maximized
            turnstile: true, // Handle turnstile challenges if present
            headless: false, // Run in non-headless mode
            customConfig: {}, // Add custom Chrome configuration if needed
            connectOption: {
                defaultViewport: null, // Disable viewport resizing
            },
            plugins: [
                StealthPlugin(),
                UserPreferencesPlugin({
                    userPrefs: {
                        download: {
                            prompt_for_download: false,
                            open_pdf_in_system_reader: true,
                        },
                        plugins: {
                            always_open_pdf_externally: true,
                        },
                    },
                }),
            ],
        });

        const downloadPath = path.resolve("./downloads"); // Define the download path

        console.log("Puppeteer Extra: Plugins enabled!");

        // const page = await browser.newPage();

        const url = 'https://csc.gov.ph/career/job/4302326'; // Replace with the target URL
        console.log("Navigating to page...");
        await page.goto(url, {
            waitUntil: ['domcontentloaded', 'networkidle0'], // Wait until the page is fully loaded
        });

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: './downloads', // Specify your download directory
        });


        await page.waitForTimeout(1000); // Short delay to ensure stability
        console.log("At page");

        // Set up download behavior
        // await page._client().send("Page.setDownloadBehavior", {
        //     behavior: "allow",
        //     downloadPath: downloadPath, // Set the download directory
        // });
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