const axios = require('axios');

async function checkData() {
    try {
        const response = await axios.get('http://localhost:5000/api/passages');
        const passages = response.data;

        passages.forEach(p => {
            console.log(`\nPassage: ${p.title} (ID: ${p._id})`);
            
            // 1. Check Matching Groups
            const matchingGroups = p.question_groups.filter(g => g.type === 'matching_headings' || g.type === 'matching_information');
            
            if (matchingGroups.length === 0) {
                console.log('  No matching groups found.');
            }

            matchingGroups.forEach((g, i) => {
                console.log(`  Matching Group ${i + 1} (${g.type}):`);
                const qNums = g.questions.map(q => q.q_number);
                console.log(`    Question Numbers: ${JSON.stringify(qNums)}`);
            });

            // 2. Check Content for placeholders
            const matches = p.content.match(/\[\s*\d+\s*\]/g);
            console.log(`  Placeholders found in text: ${matches ? JSON.stringify(matches) : 'None'}`);
        });

    } catch (error) {
        console.error('Error fetching data:', error.message);
    }
}

checkData();
