// fetch-utils.js

// Function to fetch data with a timeout
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const abortController = new AbortController();
        const { signal } = abortController;

        const fetchPromise = fetch(url, {...options, signal});

        const timeoutId = setTimeout(() => {
            abortController.abort();
            reject(new Error('Request timed out')); 
        }, timeout);

        fetchPromise
            .then(response => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
};

// Function to fetch text with CORS fallback
const fetchTextWithCorsFallback = async (url, fallbackUrl) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('CORS request failed');
        return await response.text();
    } catch (error) {
        return await fetch(fallbackUrl).then(res => res.text());
    }
};

// Function to probe a URL
const probeUrl = async (url) => {
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        return false;
    }
};

// Function to fetch with retry logic
const fetchWithRetry = async (url, options = {}, retries = 3) => {
    let attempts = 0;
    while (attempts < retries) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error('Fetch failed');
            return response;
        } catch (error) {
            attempts++;
            if (attempts === retries) throw error;
        }
    }
};

// Function to create abortable requests
const createAbortableRequest = (url, options) => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchPromise = fetch(url, {...options, signal});

    return { fetchPromise, abort: () => abortController.abort() };
};

export { fetchWithTimeout, fetchTextWithCorsFallback, probeUrl, fetchWithRetry, createAbortableRequest };