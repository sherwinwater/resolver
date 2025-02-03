import { Actor } from 'apify';
import { BasicCrawler } from 'crawlee';
import * as cheerio from 'cheerio';

await Actor.init();

const listingProxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['BUYPROXIES94952'],
});

const detailProxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['BUYPROXIES94952'],
    countryCode: 'FR',
});

const basicCrawler = new BasicCrawler({
    maxConcurrency: 3,
    maxRequestsPerMinute: 60,
    maxRequestRetries: 10,
    useSessionPool: true,
    sessionPoolOptions: {
        maxPoolSize: 20,
        sessionOptions: {
            maxUsageCount: 10,
        },
    },

    async requestHandler({ request, sendRequest, crawler }) {
        const { label } = request;
        const userData = request.userData || {};

        try {
            if (label === 'LIST') {
                const proxyUrl = await listingProxyConfiguration?.newUrl();
                const response = await sendRequest({
                    url: request.url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                        'Accept-Language': 'fr-FR,fr;q=0.9',
                    },
                });

                if (response.statusCode === 200) {
                    const $ = cheerio.load(response.body);
                    const currentPage = new URL(request.url).searchParams.get('p') || '1';

                    const jobListings = $('div[data-v-69b26c0f] a.search-result-job-card')
                        .map((_, el) => {
                            const card = $(el);
                            return {
                                title: card.find('.search-result-job-card__title').text().trim(),
                                company: card.find('.search-result-job-card__infos span').text().trim(),
                                contractAndLocation: card.find('.search-result-job-card__contract-and-location').text().trim(),
                                shortDescription: card.find('.search-result-job-card__description span').text().trim(),
                                postedTime: card.find('time').text().trim(),
                                jobUrl: card.attr('href') || '',
                                scrapedAt: new Date().toISOString(),
                                pageNumber: parseInt(currentPage, 10),
                                detailTitle: '',
                                fullDescription: '',
                                salary: '',
                            };
                        })
                        .get();

                    await crawler.addRequests(
                        jobListings
                            .filter((job) => job.jobUrl)
                            .map((job) => ({
                                url: job.jobUrl,
                                label: 'DETAIL',
                                userData: {
                                    parentUrl: request.url,
                                    listingData: job,
                                },
                            }))
                    );

                    const nextPageButton = $('button.pagination__nav-arrow:not([disabled])');
                    if (nextPageButton.length > 0) {
                        const nextPage = parseInt(currentPage, 10) + 1;
                        const nextUrl = new URL(request.url);
                        nextUrl.searchParams.set('p', nextPage.toString());

                        await crawler.addRequests([{
                            url: nextUrl.toString(),
                            label: 'LIST',
                            userData: { currentPage: nextPage },
                        }]);
                    }
                }
            } else if (label === 'DETAIL') {
                const proxyUrl = await detailProxyConfiguration?.newUrl();
                const response = await sendRequest({
                    url: request.url,
                    headers: {
                        Referer: userData.parentUrl,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
                    },
                });

                if (response.statusCode === 200) {
                    const $ = cheerio.load(response.body);
                    const listingData = userData.listingData || {};

                    const detailTitle = $('h1').text().trim();
                    const jobDescription = $('.job-details, .job-description, #job-description').text().trim();

                    const salaryMatch = jobDescription.match(/Hourly wage\s*:\s*([^\n]+)/i);
                    const salary = salaryMatch ? salaryMatch[1].trim() : '';

                    const completeJob = {
                        ...listingData,
                        detailTitle,
                        fullDescription: jobDescription,
                        salary,
                    };

                    await Actor.pushData(completeJob);
                }
            }
        } catch (error) {
            console.error(`Error processing ${request.url}:`, error);
            throw error;
        }
    },
});

await basicCrawler.run([
    {
        url: 'https://emploi.lefigaro.fr/recherche/offres-emploi',
        label: 'LIST',
        userData: { currentPage: 1 },
    },
]);

await Actor.exit();
