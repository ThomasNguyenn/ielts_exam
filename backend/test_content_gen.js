
import fetch from 'node-fetch';

const run = async () => {
    const rawText = `
    Passage Title: The History of Tea

    Tea is a popular beverage made from the leaves of the Camellia sinensis plant. It originated in China thousands of years ago.

    Question 1-3
    Choose the correct letter, A, B, C or D.

    1. Where did tea originate?
    A. India
    B. China
    C. Japan
    D. UK
    `;

    try {
        const response = await fetch('http://localhost:5000/api/content-gen/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                rawText, 
                type: 'passage' 
            })
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
};

run();
