const MATCHING_OPTION_BASED_TYPES = new Set([
    "matching_headings",
    "matching_features",
    "matching_info",
    "matching_information",
    "matching_sentence_endings",
    "matching",
]);

const COMPLETION_OPTION_BASED_TYPES = new Set([
    "summary_completion",
    "note_completion",
    "table_completion",
    "flow_chart_completion",
    "diagram_label_completion",
    "form_completion",
    "plan_map_diagram",
    "listening_map",
]);

export const OPTION_BASED_GROUP_TYPES = new Set([
    "mult_choice",
    ...MATCHING_OPTION_BASED_TYPES,
    ...COMPLETION_OPTION_BASED_TYPES,
]);

const HEADING_PREFIX_PATTERN = /^[ivxlcdm]+\s*[\).:-]?\s*/i;

export function normalizeOptionToken(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

const addAlias = (aliasToOptionIndexes, alias, optionIndex) => {
    const normalized = normalizeOptionToken(alias);
    if (!normalized) return;

    if (!aliasToOptionIndexes.has(normalized)) {
        aliasToOptionIndexes.set(normalized, new Set());
    }
    aliasToOptionIndexes.get(normalized).add(optionIndex);
};

const addOptionAliases = (aliasToOptionIndexes, option, optionIndex, { includeHeadingVariants = false } = {}) => {
    const aliasSet = new Set();
    const candidates = [option.id, option.label, option.text];

    candidates.forEach((candidate) => {
        const normalized = normalizeOptionToken(candidate);
        if (!normalized) return;
        aliasSet.add(normalized);
    });

    if (includeHeadingVariants) {
        const headingText = normalizeOptionToken(option.text);
        if (headingText) {
            const stripped = headingText.replace(HEADING_PREFIX_PATTERN, "").trim();
            if (stripped && stripped !== headingText) {
                aliasSet.add(stripped);
            }
        }
    }

    aliasSet.forEach((alias) => addAlias(aliasToOptionIndexes, alias, optionIndex));
    return aliasSet;
};

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const extractOptionPool = ({ group = {}, question = {} } = {}) => {
    const pool = [];

    if (isNonEmptyArray(question?.option)) {
        question.option.forEach((option) => {
            pool.push({
                id: option?.id || "",
                label: option?.label || "",
                text: option?.text || "",
                source: "question_option",
            });
        });
    }

    if (isNonEmptyArray(group?.headings)) {
        group.headings.forEach((heading) => {
            pool.push({
                id: heading?.id || "",
                label: heading?.label || "",
                text: heading?.text || "",
                source: "heading",
            });
        });
    }

    if (isNonEmptyArray(group?.options)) {
        group.options.forEach((option) => {
            pool.push({
                id: option?.id || "",
                label: option?.label || "",
                text: option?.text || "",
                source: "group_option",
            });
        });
    }

    return pool;
};

export function buildOptionAliasContext({ group = {}, question = {} } = {}) {
    const optionPool = extractOptionPool({ group, question });
    const aliasToOptionIndexes = new Map();
    const options = optionPool.map((option, optionIndex) => {
        const aliases = addOptionAliases(aliasToOptionIndexes, option, optionIndex, {
            includeHeadingVariants: option.source === "heading",
        });
        return { ...option, aliases };
    });

    return {
        options,
        aliasToOptionIndexes,
    };
}

export function isOptionBasedGroupType(groupType = "") {
    return OPTION_BASED_GROUP_TYPES.has(String(groupType || "").trim().toLowerCase());
}

export function hasResolvableOptionPool(aliasContext = null) {
    return Boolean(aliasContext && Array.isArray(aliasContext.options) && aliasContext.options.length > 0);
}

export function expandCorrectAnswerAliases(
    correctAnswers = [],
    aliasContext = null,
    { includeUnresolvedTokenFallback = true, normalizer = normalizeOptionToken } = {},
) {
    const acceptedAliases = new Set();
    const unresolvedTokens = [];
    const hasPool = hasResolvableOptionPool(aliasContext);

    (correctAnswers || []).forEach((token) => {
        const normalizedToken = normalizer(token);
        if (!normalizedToken) return;

        if (!hasPool) {
            acceptedAliases.add(normalizedToken);
            return;
        }

        const matchedOptionIndexes = aliasContext.aliasToOptionIndexes.get(normalizedToken);
        if (!matchedOptionIndexes || matchedOptionIndexes.size === 0) {
            unresolvedTokens.push(String(token));
            if (includeUnresolvedTokenFallback) {
                acceptedAliases.add(normalizedToken);
            }
            return;
        }

        matchedOptionIndexes.forEach((optionIndex) => {
            const option = aliasContext.options[optionIndex];
            if (!option) return;
            option.aliases.forEach((alias) => acceptedAliases.add(alias));
        });
    });

    return {
        acceptedAliases,
        unresolvedTokens,
    };
}

export function previewOptionAliases(aliasContext = null, { limit = 8 } = {}) {
    if (!hasResolvableOptionPool(aliasContext)) return [];

    const seen = new Set();
    const preview = [];
    const pushCandidate = (value) => {
        const raw = String(value || "").trim();
        if (!raw) return;
        const normalized = normalizeOptionToken(raw);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        preview.push(raw);
    };

    aliasContext.options.forEach((option) => {
        pushCandidate(option.id);
        pushCandidate(option.label);
        pushCandidate(option.text);
    });

    return preview.slice(0, Math.max(1, Number(limit) || 8));
}
