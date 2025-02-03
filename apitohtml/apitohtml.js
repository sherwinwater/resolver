import axios from 'axios'; // Ensure axios is installed

// Define the API endpoint
const API_URL = 'https://www.metacareers.com/graphql';

// Define the request headers
const HEADERS = {
    'Content-Type': 'application/json',
};

// Define the request data (formatted correctly)
// const PAYLOAD = new URLSearchParams({
//     lsd: 'AVrjnrv2N_s',
//     fb_api_req_friendly_name: 'CareersJobSearchFiltersQuery',
//     variables: '{}', // This is an empty JSON object
//     server_timestamps: 'true',
//     doc_id: '6282233261844491',
// }).toString(); // Converts the object to x-www-form-urlencoded string

const PAYLOAD = {
    url: 'https://www.metacareers.com/graphql',
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    data: 'lsd=AVrjnrv2N_s&fb_api_req_friendly_name=CareersJobSearchFiltersQuery&variables=%7B%7D&server_timestamps=true&doc_id=6282233261844491'
}

// Function to send POST request
async function fetchGraphQLData() {
    try {
        const response = await axios.post(API_URL, PAYLOAD, {
            headers: HEADERS,
        });

        console.log('[SUCCESS] Response Data:', response.data);
    } catch (error) {
        console.error('[ERROR] Failed to fetch data:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

// Run the function
fetchGraphQLData();
