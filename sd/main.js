import { connect } from "puppeteer-real-browser";
import fs from "fs/promises";

const realBrowserOption = {
    args: ["--window-size=1300,768"],
    turnstile: true,
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};

async function login(page, email, password) {
    try {
        // Navigate to the homepage
        console.log("Navigating to Educative.io...");
        await page.goto("https://www.educative.io/", { waitUntil: "networkidle0" });

        // Click the "Log In" button
        console.log("Clicking the 'Log In' button...");
        await page.waitForSelector(".Header_loginBtn__qTGHe", { visible: true });
        await page.click(".Header_loginBtn__qTGHe");

        // Wait for the iframe to load
        console.log("Waiting for iframe to load...");
        await page.waitForSelector("iframe");

        // Get the iframe and switch context
        const iframeElement = await page.$("iframe");
        const iframe = await iframeElement.contentFrame();

        // Ensure iframe is available
        if (!iframe) {
            throw new Error("Could not locate iframe for the login form.");
        }

        console.log("Switching to iframe context...");

        // Wait for the email field in the iframe
        await iframe.waitForSelector("#email-field", { visible: true });

        // Enter email
        console.log("Entering email...");
        await iframe.type("#email-field", email, { delay: 100 });

        // Enter password
        console.log("Entering password...");
        await iframe.type("#password-field", password, { delay: 100 });

        // Click on the "Log In" button
        console.log("Submitting the login form...");
        await Promise.all([
            iframe.click(".LoginState_loginButton__CWh1r"),
            page.waitForNavigation({ waitUntil: "networkidle0" }), // Wait for the main page to load
        ]);

        console.log("Login successful!");
    } catch (error) {
        console.error("Error during login:", error);
    }
}

async function downloadPageContent(page, url, filename) {
    try {
        // Navigate to the target page
        await page.goto(url, { waitUntil: "networkidle0" });

        // Wait for the content to load
        await page.waitForSelector("body");

        // Extract the page content
        const content = await page.evaluate(() => document.body.innerHTML);

        // Save the content to a file
        await fs.writeFile(filename, content, "utf8");
        console.log(`Page content saved to ${filename}`);
    } catch (error) {
        console.error("Error downloading page content:", error);
    }
}

async function main() {
    console.log("Starting scraper...");

    const { browser, page } = await connect(realBrowserOption);

    try {
        const email = "your_email@example.com"; // Replace with your email
        const password = "your_password"; // Replace with your password

        // Perform login
        await login(page, email, password);

        // Download content from the target page
        const targetUrl =
            "https://www.educative.io/courses/grokking-the-system-design-interview/system-design-the-distributed-messaging-queue";
        const outputFilename = "distributed_messaging_queue.html";

        await downloadPageContent(page, targetUrl, outputFilename);
    } catch (error) {
        console.error("Error in main scraper function:", error);
    } finally {
        await browser.close();
        console.log("Browser closed.");
    }
}

main();
