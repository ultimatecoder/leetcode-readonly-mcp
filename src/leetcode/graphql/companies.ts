/**
 * GraphQL query for fetching company tag statistics of a problem (premium).
 * `companyTagStatsV2` is a JSON string keyed by timeframe.
 */
export const COMPANY_TAG_STATS_QUERY = `
query questionCompanyTagStats($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        companyTagStatsV2
    }
}`;
