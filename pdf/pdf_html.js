import PDF2HTML from 'pdf2html';
import fs from 'fs';

function convert(pdfPath, options, callback) {
    var isCompleted = false;
    console.log(`[INFO] Starting PDF conversion: ${pdfPath}`);

    // Start timeout timer
    var timer = setTimeout(() => {
        isCompleted = true;
        console.error(`[ERROR] Timeout reached: ${options.timeout}ms`);
        callback.onFailed(`Timeout reached ms ${options.timeout}`);
    }, options.timeout || 30000);


    // Start PDF conversion
    PDF2HTML.html(pdfPath, (err, html) => {
        clearTimeout(timer); // Clear timeout since conversion is complete

        if (isCompleted) {
            console.warn(`[WARNING] PDF conversion completed after timeout. Ignoring results.`);
            return;
        }

        isCompleted = true;

        if (err) {
            console.error(`[ERROR] PDF conversion failed: ${err}`);
            callback.onFailed(err);
            return;
        }

        html = html.replace('<head>', '<head><meta charset="UTF-8">');
        console.log("[SUCCESS] PDF converted successfully!");

        // Save output HTML
        const outputPath = 'output.html';
        fs.writeFileSync(outputPath, html, 'utf8');
        console.log(`[INFO] HTML saved to: ${outputPath}`);

        callback.onSuccess(html);
    });
}

// Get PDF file path from command-line arguments
const pdfPath = process.argv[2] || '/Users/shuwenwang/Documents/dev/pocs/resolver/pdf/x.pdf'; // Default to 'sample.pdf' if no argument is provided
const options = { timeout: 10000 }; // 10 seconds timeout

if (!fs.existsSync(pdfPath)) {
    console.error(`[ERROR] PDF file not found at: ${pdfPath}`);
    process.exit(1);
}

// Run conversion
convert(pdfPath, options, {
    onSuccess: (html) => console.log(`[INFO] Conversion completed!`),
    onFailed: (error) => console.error(`[ERROR] Conversion failed: ${error}`)
});
