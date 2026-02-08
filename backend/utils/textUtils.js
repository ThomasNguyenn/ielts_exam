// Levenshtein Distance Algorithm (Word Level)
function calculateWER(reference, hypothesis) {
    if (!reference || !hypothesis) return { wer: 0, ops: [] };

    // Normalize
    const normalize = (text) => text.toLowerCase().replace(/[.,!?;:"]/g, '').trim().split(/\s+/);
    const r = normalize(reference);
    const h = normalize(hypothesis);

    const d = Array(r.length + 1).fill(null).map(() => Array(h.length + 1).fill(0));
    const ops = Array(r.length + 1).fill(null).map(() => Array(h.length + 1).fill(''));

    for (let i = 0; i <= r.length; i++) {
        d[i][0] = i;
        ops[i][0] = 'deletion';
    }
    for (let j = 0; j <= h.length; j++) {
        d[0][j] = j;
        ops[0][j] = 'insertion';
    }

    for (let i = 1; i <= r.length; i++) {
        for (let j = 1; j <= h.length; j++) {
            if (r[i - 1] === h[j - 1]) {
                d[i][j] = d[i - 1][j - 1]; // Match
                ops[i][j] = 'match';
            } else {
                const substitution = d[i - 1][j - 1] + 1;
                const insertion = d[i][j - 1] + 1;
                const deletion = d[i - 1][j] + 1;

                const min = Math.min(substitution, insertion, deletion);
                d[i][j] = min;

                if (min === substitution) ops[i][j] = 'substitution';
                else if (min === insertion) ops[i][j] = 'insertion';
                else ops[i][j] = 'deletion';
            }
        }
    }

    // Backtrack to get diff list
    const diff = [];
    let i = r.length;
    let j = h.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && ops[i][j] === 'match') {
            diff.unshift({ type: 'match', value: r[i - 1] });
            i--; j--;
        } else if (i > 0 && j > 0 && ops[i][j] === 'substitution') {
            diff.unshift({ type: 'substitution', expected: r[i - 1], actual: h[j - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || ops[i][j] === 'insertion')) {
            diff.unshift({ type: 'insertion', value: h[j - 1] });
            j--;
        } else if (i > 0 && (j === 0 || ops[i][j] === 'deletion')) {
            diff.unshift({ type: 'deletion', value: r[i - 1] });
            i--;
        }
    }

    return {
        wer: d[r.length][h.length] / r.length,
        diff: diff
    };
}

// Simple heuristic for missing endings
function detectMissingEndings(reference, hypothesis) {
    const rWords = reference.toLowerCase().match(/\b\w+\b/g) || [];
    const hWords = new Set(hypothesis.toLowerCase().match(/\b\w+\b/g) || []);

    const issues = [];

    rWords.forEach(word => {
        if (hWords.has(word)) return; // Exact match found

        // Check for 'ed'
        if (word.endsWith('ed') && hWords.has(word.slice(0, -2))) {
            issues.push({ word, type: 'missing_ed' });
        }
        // Check for 's' or 'es'
        else if (word.endsWith('s') && hWords.has(word.slice(0, -1))) {
            issues.push({ word, type: 'missing_s' });
        }
        else if (word.endsWith('es') && hWords.has(word.slice(0, -2))) {
            issues.push({ word, type: 'missing_s' });
        }
    });

    return issues;
}

export { calculateWER, detectMissingEndings };
