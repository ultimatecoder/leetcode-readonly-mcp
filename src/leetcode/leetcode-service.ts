import { Credential, LeetCode } from "leetcode-query";
import { resolveAssetUrl } from "../utils/images.js";
import logger from "../utils/logger.js";
import { COMPANY_TAG_STATS_QUERY } from "./graphql/companies.js";
import { EDITORIAL_QUERY } from "./graphql/editorial.js";
import { buildPlaygroundCodesQuery } from "./graphql/playground.js";
import { SEARCH_PROBLEMS_QUERY } from "./graphql/search-problems.js";

export const LEETCODE_ORIGIN = "https://leetcode.com";

const SLIDES_BASE_URL =
    "https://assets.leetcode.com/static_assets/media/documents/";

export interface PlaygroundCode {
    langSlug: string;
    code: string;
}

export interface EditorialData {
    questionFrontendId?: string;
    title?: string;
    titleSlug: string;
    isPaidOnly?: boolean;
    content: string | null;
    paidOnly: boolean;
    canSeeDetail: boolean;
    hasVideoSolution: boolean;
    paidOnlyVideo: boolean;
}

export interface CompanyStat {
    name: string;
    slug?: string;
    timesEncountered?: number;
}

/**
 * Read-only LeetCode (leetcode.com) service.
 *
 * Every method only reads data: GraphQL queries through leetcode-query,
 * or plain GETs for static editorial assets.
 */
export class LeetCodeService {
    private readonly leetCodeApi: LeetCode;
    private readonly credential: Credential;

    constructor(leetCodeApi: LeetCode, credential: Credential) {
        this.leetCodeApi = leetCodeApi;
        this.credential = credential;
    }

    /**
     * Creates a service, initializing the credential with an optional session cookie.
     */
    static async create(sessionCookie?: string): Promise<LeetCodeService> {
        const credential = new Credential();
        if (sessionCookie) {
            await credential.init(sessionCookie);
        }
        return new LeetCodeService(new LeetCode(credential), credential);
    }

    isAuthenticated(): boolean {
        return !!this.credential.session;
    }

    async fetchDailyChallenge(): Promise<any> {
        return await this.leetCodeApi.daily();
    }

    async fetchProblem(titleSlug: string): Promise<any> {
        return await this.leetCodeApi.problem(titleSlug);
    }

    async fetchProblemSimplified(titleSlug: string): Promise<any> {
        const problem = await this.fetchProblem(titleSlug);
        if (!problem) {
            throw new Error(`Problem ${titleSlug} not found`);
        }

        const filteredTopicTags =
            problem.topicTags?.map((tag: any) => tag.slug) || [];

        const filteredCodeSnippets =
            problem.codeSnippets?.filter((snippet: any) =>
                ["cpp", "python3", "java"].includes(snippet.langSlug)
            ) || [];

        let parsedSimilarQuestions: any[] = [];
        if (problem.similarQuestions) {
            try {
                const allQuestions = JSON.parse(problem.similarQuestions);
                parsedSimilarQuestions = allQuestions.map((q: any) => ({
                    title: q.title,
                    titleSlug: q.titleSlug,
                    difficulty: q.difficulty
                }));
            } catch (e) {
                logger.error("Error parsing similarQuestions: %s", e);
            }
        }

        return {
            titleSlug,
            questionId: problem.questionId,
            questionFrontendId: problem.questionFrontendId,
            title: problem.title,
            content: problem.content,
            isPaidOnly: problem.isPaidOnly,
            difficulty: problem.difficulty,
            topicTags: filteredTopicTags,
            codeSnippets: filteredCodeSnippets,
            exampleTestcases: problem.exampleTestcases,
            hints: problem.hints,
            similarQuestions: parsedSimilarQuestions
        };
    }

    /**
     * Fetches company tag statistics (premium). Returns null when unavailable,
     * e.g. without a premium session.
     */
    async fetchCompanies(
        titleSlug: string
    ): Promise<Record<string, CompanyStat[]> | null> {
        try {
            const response = await this.leetCodeApi.graphql({
                query: COMPANY_TAG_STATS_QUERY,
                variables: { titleSlug }
            });
            const raw = response.data?.question?.companyTagStatsV2;
            return parseCompanyTagStats(raw);
        } catch (e) {
            logger.error("Error fetching company tag stats: %s", e);
            return null;
        }
    }

    async searchProblems(
        category?: string,
        tags?: string[],
        difficulty?: string,
        limit: number = 10,
        offset: number = 0,
        searchKeywords?: string
    ): Promise<any> {
        const filters: any = {};
        if (difficulty) {
            filters.difficulty = difficulty.toUpperCase();
        }
        if (tags && tags.length > 0) {
            filters.tags = tags;
        }
        if (searchKeywords) {
            filters.searchKeywords = searchKeywords;
        }

        const response = await this.leetCodeApi.graphql({
            query: SEARCH_PROBLEMS_QUERY,
            variables: {
                categorySlug: category,
                limit,
                skip: offset,
                filters
            }
        });

        const questionList = response.data?.problemsetQuestionList;
        if (!questionList) {
            return {
                total: 0,
                questions: []
            };
        }
        return {
            total: questionList.total,
            questions: questionList.questions.map((question: any) => ({
                questionFrontendId: question.questionFrontendId,
                title: question.title,
                titleSlug: question.titleSlug,
                difficulty: question.difficulty,
                isPaidOnly: question.isPaidOnly,
                acRate: question.acRate,
                topicTags: question.topicTags.map((tag: any) => tag.slug)
            }))
        };
    }

    async fetchEditorial(titleSlug: string): Promise<EditorialData> {
        const response = await this.leetCodeApi.graphql({
            query: EDITORIAL_QUERY,
            variables: { titleSlug }
        });
        const question = response.data?.question;
        if (!question) {
            throw new Error(`Problem ${titleSlug} not found`);
        }
        const solution = question.solution;
        return {
            questionFrontendId: question.questionFrontendId,
            title: question.title,
            titleSlug,
            isPaidOnly: question.isPaidOnly,
            content: solution?.content ?? null,
            paidOnly: !!solution?.paidOnly,
            canSeeDetail: !!solution?.canSeeDetail,
            hasVideoSolution: !!solution?.hasVideoSolution,
            paidOnlyVideo: !!solution?.paidOnlyVideo
        };
    }

    async fetchPlaygroundCodes(uuid: string): Promise<PlaygroundCode[]> {
        if (!/^[A-Za-z0-9_-]+$/.test(uuid)) {
            throw new Error(`Invalid playground uuid: ${uuid}`);
        }
        const response = await this.leetCodeApi.graphql({
            query: buildPlaygroundCodesQuery(uuid)
        });
        return response.data?.allPlaygroundCodes ?? [];
    }

    /**
     * Fetches the frame image URLs of an editorial slideshow.
     *
     * @param stem - Path after "Documents/" without ".json", e.g. "146/146_slides"
     */
    async fetchSlideFrames(stem: string): Promise<string[]> {
        const candidates = [stem, stem.toLowerCase()].filter(
            (value, index, all) => all.indexOf(value) === index
        );
        for (const candidate of candidates) {
            const url = SLIDES_BASE_URL + candidate + ".json";
            const res = await fetch(url);
            if (!res.ok) {
                continue;
            }
            const data: any = await res.json();
            if (Array.isArray(data?.timeline)) {
                return data.timeline
                    .map((frame: any) => frame?.image)
                    .filter((image: unknown) => typeof image === "string")
                    .map((image: string) => resolveAssetUrl(image, url));
            }
        }
        throw new Error(`Slide timeline not found for ${stem}`);
    }
}

/**
 * Parses companyTagStatsV2 (JSON string keyed by timeframe) into company lists.
 */
export function parseCompanyTagStats(
    raw: unknown
): Record<string, CompanyStat[]> | null {
    if (typeof raw !== "string" || raw.length === 0) {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }
    const result: Record<string, CompanyStat[]> = {};
    for (const [timeframe, companies] of Object.entries(parsed)) {
        if (!Array.isArray(companies)) {
            continue;
        }
        result[timeframe] = companies
            .filter((company: any) => company && company.name)
            .map((company: any) => ({
                name: company.name,
                slug: company.slug,
                timesEncountered: company.timesEncountered ?? company.count
            }));
    }
    return result;
}
