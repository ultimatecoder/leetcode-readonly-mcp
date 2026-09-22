/**
 * GraphQL query for fetching the official editorial of a problem.
 * `content` is only populated when the session can see the editorial
 * (free editorials, or premium editorials with a premium session).
 */
export const EDITORIAL_QUERY = `
query questionEditorial($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        isPaidOnly
        solution {
            id
            content
            paidOnly
            canSeeDetail
            hasVideoSolution
            paidOnlyVideo
        }
    }
}`;
