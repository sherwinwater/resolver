import { Actor } from 'apify';
import { BasicCrawler } from 'crawlee';
import * as cheerio from 'cheerio';

import { UserData, ListingResponse } from './types.js';

await Actor.init();

const listingProxyConfiguration = await Actor.createProxyConfiguration({
    groups: [
        'BUYPROXIES94952',
    ],
});

const detailProxyConfiguration = await Actor.createProxyConfiguration({
    groups: [
        // 'RESIDENTIAL',
        'BUYPROXIES94952',
    ],
    countryCode: 'TR',
});

const basicCrawler = new BasicCrawler({
    maxConcurrency: 5, // has big impact on kariver
    maxRequestsPerMinute: 90, // <- option to slow down scraper
    maxRequestRetries: 40, // use high value in case of blocks
    useSessionPool: true, // extra options
    sessionPoolOptions: {
        maxPoolSize: 50,
        sessionOptions: {
            maxUsageCount: 50,
        },
    },
    async requestHandler({ request, sendRequest, crawler, session }) {
        let { currentPage = 1 } = request.userData as UserData;
        const { label } = request;

        if (label === 'LIST') {
            const proxyUrl = await listingProxyConfiguration.newUrl();

            const resp = await sendRequest({
                proxyUrl,
                url: request.url,
                headers: {
                    Referer: 'https://www.kariyer.net', // eslint-disable-next-line max-len
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
                    priority: 'u=0, i',
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                },
            });

            if (resp.statusCode === 200) {
                console.log(`LIST | ${request.url} | Response Status: 200`);

                const $ = cheerio.load(resp.body);

                // Extract listing data here
                const listings = $('div.listing').map((i, el) => {
                    const title = $(el).find('h2.title').text().trim();
                    const link = $(el).find('a').attr('href');
                    return { title, link };
                }).get();

                // Process listings and enqueue detail pages
                for (const listing of listings) {
                    await crawler.addRequests([{
                        url: listing.link,
                        label: 'DETAIL',
                        userData: { currentPage },
                    }]);
                }

                // Enqueue the next page if necessary
                const nextPageUrl = $('a.next-page').attr('href');
                if (nextPageUrl) {
                    await crawler.addRequests([{
                        url: nextPageUrl,
                        label: 'LIST',
                        userData: { currentPage: currentPage + 1 },
                    }]);
                }
            }
        } else if (label === 'DETAIL') {
            const proxyUrl = await detailProxyConfiguration.newUrl();

            const resp = await sendRequest({
                proxyUrl,
                url: request.url,
                headers: {
                    Referer: 'https://www.kariyer.net', // eslint-disable-next-line max-len
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
                    priority: 'u=0, i',
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                },
            });

            if (resp.statusCode === 200) {
                console.log(`DETAIL | ${request.url} | Response Status: 200`);

                const $ = cheerio.load(resp.body);

                const title = $('title').text();
                const companyName = $('h1 a.company-name').text();

                // Process and save the detail data here
                console.log(`Title: ${title}, Company: ${companyName}`);
            }
        }
    },
});

await basicCrawler.run();

await Actor.exit();