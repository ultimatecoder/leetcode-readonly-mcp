/**
 * GraphQL query for fetching the code of a shared playground embedded in an editorial.
 * The uuid is inlined (validated by the caller) because the argument type is not
 * part of the public schema.
 */
export function buildPlaygroundCodesQuery(uuid: string): string {
    return `
query allPlaygroundCodes {
    allPlaygroundCodes(uuid: "${uuid}") {
        code
        langSlug
    }
}`;
}
