// centralized configuration for all URLs, timeouts, cache settings, and constants

const config = {
    urls: {
        apiUrl: 'https://api.example.com',
        homepageUrl: 'https://www.example.com',
    },
    timeouts: {
        requestTimeout: 5000, // 5 seconds
        connectionTimeout: 10000, // 10 seconds
    },
    cacheSettings: {
        cacheDuration: 3600, // 1 hour in seconds
        useCache: true,
    },
    constants: {
        maxRetries: 3,
        appName: 'PHTESTP',
    },
};

module.exports = config;