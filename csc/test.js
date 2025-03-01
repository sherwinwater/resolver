import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
// import pdf from 'pdf-parse';
import path from 'path';

const realBrowserOption = {
    args: ["--start-maximized"],
    turnstile: true,
    headless: false,
    disableXvfb: true,
    customConfig: {
        prefs: {
            download: {
                default_directory: "/Users/shuwenwang/Documents/dev/pocs/resolver/csc/downloads",
                prompt_for_download: false,
                open_pdf_in_system_reader: false
            },
            plugins: {
                always_open_pdf_externally: true
            }
        }
    },
    connectOption: {
        defaultViewport: null
    },
};

const { page, browser } = await connect(realBrowserOption);

const link = 'https://csc.gov.ph/career/job/4333282';
await page.evaluate((link) => {
    location.href = link;
}, link);
//
// // Wait for download to complete (adjust delay as needed)
// await new Promise(resolve => setTimeout(resolve, 10000));
//
// const downloadDir = "/Users/shuwenwang/Documents/dev/pocs/resolver/csc/downloads";
// const files = fs.readdirSync(downloadDir).filter(file => file.endsWith('.pdf'));
//
// if (files.length > 0) {
//     const pdfPath = path.join(downloadDir, files[0]);
//     const dataBuffer = fs.readFileSync(pdfPath);
//
//     pdf(dataBuffer).then(data => {
//         const htmlPath = pdfPath.replace('.pdf', '.html');
//         fs.writeFileSync(htmlPath, `<html><body><pre>${data.text}</pre></body></html>`, 'utf8');
//         console.log(`Converted PDF to HTML: ${htmlPath}`);
//     });
// } else {
//     console.log("No PDF files found in the download directory.");
// }
//
// await browser.close();