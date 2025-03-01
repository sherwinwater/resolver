import puppeteer from "puppeteer-core";

const sleep = async (timeout) => {
    return new Promise((resolve) => setTimeout(resolve, timeout));
};

async function testFunction() {
    const browser = await puppeteer.launch({
        defaultViewport: null,
        headless: false, // Set headless to false to see browser actions
        executablePath:
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });
    const page = (await browser.pages())[0];
    await page.goto("https://www.g2.com/products/g2/reviews");
    await sleep(10000);

    await browser.close();
}

testFunction().catch(console.error);