const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js'); // For OCR
const fs = require('fs'); // For file system operations

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to the page
    await page.goto('https://csc.gov.ph/career/job/4295201', { waitUntil: 'networkidle2' });

    try {
        // Take a screenshot of the page
        const screenshotPath = 'screenshot.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved at: ${screenshotPath}`);

        // Use Tesseract.js to extract text from the screenshot
        console.log('Starting OCR...');
        const { data: { text } } = await Tesseract.recognize(
            screenshotPath, // Path to the screenshot
            'eng',          // Language
            {
                logger: (info) => console.log(info), // Log progress
            }
        );

        console.log('Extracted Text:', text);

        // Save the extracted text to a file
        const outputFilePath = 'extracted_text.txt';
        fs.writeFileSync(outputFilePath, text, 'utf8');
        console.log(`Extracted text saved to: ${outputFilePath}`);
    } catch (error) {
        console.error('Error during screenshot or OCR:', error);
    } finally {
        await browser.close();
    }
})();
