const {Builder, By, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

(async function scrape() {
    let options = new firefox.Options();
    options.addArguments('--headful'); // Run in headless mode

    // Initialize the WebDriver
    let driver = await new Builder()
        .forBrowser('firefox')
        .setFirefoxOptions(options)
        .build();

    // Initialize the WebDriver for Firefox
    // let driver = await new Builder().forBrowser('firefox').build();

    try {
        // Navigate to the target page
        await driver.get('https://csc.gov.ph/career/job/4295201');

        // Wait for the #viewer element to be present
        await driver.wait(until.elementLocated(By.id('viewer')), 10000);

        // Wait for the .textLayer within #viewer to be present
        await driver.wait(until.elementLocated(By.css('#viewer .textLayer')), 10000);

        // Extract content from the textLayer
        let elements = await driver.findElements(By.css('#viewer .textLayer span'));
        let content = '';
        for (let element of elements) {
            content += await element.getText() + ' ';
        }

        console.log('Extracted Content:', content.trim());
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        // Close the browser
        await driver.quit();
    }
})();
