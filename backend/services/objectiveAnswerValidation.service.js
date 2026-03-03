import {
    buildOptionAliasContext,
    expandCorrectAnswerAliases,
    hasResolvableOptionPool,
    isOptionBasedGroupType,
    previewOptionAliases,
} from "./objectiveAnswerAlias.service.js";

export class ObjectiveAnswerValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = "ObjectiveAnswerValidationError";
        this.statusCode = 400;
        this.code = "INVALID_OBJECTIVE_ANSWER_MAPPING";
        this.details = details;
    }
}

const normalizeCorrectAnswerTokens = (question = {}) =>
    (Array.isArray(question?.correct_answers) ? question.correct_answers : [])
        .map((token) => String(token || "").trim())
        .filter(Boolean);

export function validateObjectiveAnswerMappings(questionGroups = []) {
    const groups = Array.isArray(questionGroups) ? questionGroups : [];
    const issues = [];

    groups.forEach((group, groupIndex) => {
        const groupType = String(group?.type || "").trim().toLowerCase();
        if (!isOptionBasedGroupType(groupType)) return;

        const questions = Array.isArray(group?.questions) ? group.questions : [];
        questions.forEach((question, questionIndex) => {
            const tokens = normalizeCorrectAnswerTokens(question);
            if (tokens.length === 0) return;

            const aliasContext = buildOptionAliasContext({ group, question });
            if (!hasResolvableOptionPool(aliasContext)) return;

            const preview = previewOptionAliases(aliasContext, { limit: 10 });
            tokens.forEach((token) => {
                const { unresolvedTokens } = expandCorrectAnswerAliases([token], aliasContext, {
                    includeUnresolvedTokenFallback: false,
                });

                if (unresolvedTokens.length === 0) return;

                issues.push({
                    groupIndex,
                    questionNumber: Number(question?.q_number) || questionIndex + 1,
                    groupType,
                    invalidToken: token,
                    expectedOptions: preview,
                });
            });
        });
    });

    return issues;
}

export function assertObjectiveAnswerMappings(questionGroups = []) {
    const issues = validateObjectiveAnswerMappings(questionGroups);
    if (issues.length === 0) return;

    throw new ObjectiveAnswerValidationError(
        "Some correct answers do not match available option aliases (id/label/text).",
        issues,
    );
}
