import { connect } from "puppeteer-real-browser";
import fs from "fs/promises";

const realBrowserOption = {
    args: ["--window-size=1300,768"],
    turnstile: true, // Ensures compatibility with Turnstile
    headless: false,
    customConfig: {},
    connectOption: {
        defaultViewport: null,
    },
    plugins: [],
};

async function waitForCloudflareVerification(page) {
    console.log("Waiting for Cloudflare verification...");

    try {
        // Wait for Cloudflare to complete (checking for the absence of challenge elements)
        await page.waitForFunction(
            () => !document.querySelector("#cf-challenge-running"),
            { timeout: 30000 } // Wait for up to 30 seconds
        );
        console.log("Cloudflare verification passed!");
    } catch (error) {
        console.error("Cloudflare verification failed or timeout:", error);
        throw error; // Stop execution if verification fails
    }
}

async function loginToLeetCode(browser, page, email, password) {
    try {
        // Navigate to the LeetCode login page
        console.log("Navigating to LeetCode login page...");
        await page.goto("https://leetcode.com/accounts/login/", { waitUntil: "networkidle2" });

        // Wait for Cloudflare verification to complete
        console.log("Waiting for Cloudflare verification...");
        await page.waitForSelector("#cf-challenge-running", { hidden: true, timeout: 30000 });
        console.log("Cloudflare verification passed!");

        // Wait for the login form to load
        console.log("Waiting for login form...");
        await page.waitForSelector("#id_login", { visible: true });
        await page.waitForSelector("#id_password", { visible: true });

        // Use evaluate to set the email
        console.log("Setting username...");
        await page.evaluate((selector, value) => {
            const input = document.querySelector(selector);
            input.value = ""; // Clear the input field
            input.focus(); // Focus on the input
            input.value = value; // Set the full value
            input.dispatchEvent(new Event("input", { bubbles: true })); // Trigger input events
        }, "#id_login", email);

        // Use evaluate to set the password
        console.log("Setting password...");
        await page.evaluate((selector, value) => {
            const input = document.querySelector(selector);
            input.value = ""; // Clear the input field
            input.focus(); // Focus on the input
            input.value = value; // Set the full value
            input.dispatchEvent(new Event("input", { bubbles: true })); // Trigger input events
        }, "#id_password", password);

        // Click the "Sign In" button
        console.log("Clicking 'Sign In' button...");
        await Promise.all([
            page.click("#signin_btn"),
            page.waitForNavigation({ waitUntil: "networkidle2" }),
        ]);

        console.log("Successfully logged in!");
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
}

async function fetchLeetCodeData() {
    console.log("Starting Puppeteer...");
    const { browser, page } = await connect(realBrowserOption);

    try {
        const email = "your_email@example.com"; // Replace with your email
        const password = "your_password"; // Replace with your password

        // Log in to LeetCode
        await loginToLeetCode(browser, page, email, password);

        // Navigate to a specific page after login
        const targetUrl = "https://leetcode.com/problemset/all/";
        console.log(`Navigating to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "networkidle2" });

        // Fetch and save the content of the page
        console.log("Fetching page content...");
        const content = await page.content(); // Get the entire HTML content
        await fs.writeFile("leetcode_problems.html", content, "utf8");
        console.log("Page content saved to 'leetcode_problems.html'!");

    } catch (error) {
        console.error("Error in main function:", error);
    } finally {
        await browser.close();
        console.log("Browser closed.");
    }
}

fetchLeetCodeData();
