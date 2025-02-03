import { gotScraping } from 'got-scraping';

gotScraping
    .get('https://apify.com')
    .then( ({ body }) => console.log(body));