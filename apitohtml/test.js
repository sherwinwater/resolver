import axios from 'axios';

async function fetchData(attempt = 1) {
    const payload = {
        url: 'https://www.metacareers.com/graphql',
        method: 'post',
        headers: {
            // The effective header here is "application/x-www-form-urlencoded"
            // even though you might see both in your original working payload.
            'Content-Type': 'application/x-www-form-urlencoded',
            'sec-ch-ua': '" Not;A Brand";v="99", "Chromium";v="99", "Google Chrome";v="99"',
            referer: 'https://www.metacareers.com/',
            'accept-language': 'en-US',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
            'sec-ch-ua-platform': '"Windows"',
            accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'x-fb-lsd': 'AVrvlbBO3TE',
            'sec-fetch-site': 'same-origin'
        },
        // The raw string is exactly the one that worked for you.
        data: 'lsd=AVrvlbBO3TE&fb_api_req_friendly_name=CareersJobSearchFiltersQuery&variables=%7B%7D&server_timestamps=true&doc_id=6282233261844491',
        timeout: 30000,
        // Disable any transformation so that the string is sent unchanged.
        transformRequest: [(data) => data]
    };

    try {
        const res = await axios(payload);
        console.log('[SUCCESS] Response:', res.data);
        return res;
    } catch (e) {
        console.error(`[ERROR] Attempt ${attempt} failed - ${e.message}`);
        console.error('Error response data:', e.response && e.response.data);
        return {
            hasError: true,
            res: e.response || {},
            status: e.response?.status || 500,
            error: e
        };
    }
}

fetchData();
