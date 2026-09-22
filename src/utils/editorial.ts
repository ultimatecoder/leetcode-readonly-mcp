import { PlaygroundCode } from "../leetcode/leetcode-service.js";
import { extractImages, ImageRef } from "./images.js";
import logger from "./logger.js";

export const DEFAULT_EDITORIAL_LANG = "java";

const PLAYGROUND_IFRAME =
    /<iframe\b[^>]*?\bsrc\s*=\s*["'][^"']*?\/playground\/([A-Za-z0-9_-]+)\/shared[^"']*["'][^>]*>\s*(?:<\/iframe>)?/gi;
const SLIDE_MARKER = /!\?!([\s\S]*?)!\?!/g;

const FENCE_LANG: Record<string, string> = {
    python3: "python",
    golang: "go"
};

export interface EditorialFetchers {
    fetchPlaygroundCodes: (uuid: string) => Promise<PlaygroundCode[]>;
    fetchSlideFrames: (stem: string) => Promise<string[]>;
}

export interface RenderedEditorial {
    text: string;
    images: ImageRef[];
}

/**
 * Extracts the documents path stem from a slide marker body,
 * e.g. "../Documents/146/146_slides.json:1280,720" -> "146/146_slides".
 */
export function parseSlideStem(markerBody: string): string | null {
    const path = markerBody.trim().replace(/:\d+\s*,\s*\d+$/, "");
    if (!/\.json$/i.test(path)) {
        return null;
    }
    const parts = path
        .replace(/\.json$/i, "")
        .split("/")
        .filter((part) => part && part !== "." && part !== "..");
    if (parts.length < 2 || parts[0].toLowerCase() !== "documents") {
        return null;
    }
    return parts.slice(1).join("/");
}

function renderCodes(
    uuid: string,
    codes: PlaygroundCode[],
    lang: string
): string {
    const selected =
        lang === "all" ? codes : codes.filter((code) => code.langSlug === lang);
    if (selected.length === 0) {
        const available = codes.map((code) => code.langSlug).join(", ");
        return `\n> Code (playground ${uuid}) has no ${lang} version. Available: ${available || "none"}.\n`;
    }
    return selected
        .map((code) => {
            const fence = FENCE_LANG[code.langSlug] ?? code.langSlug;
            return `\n\`\`\`${fence}\n${code.code.replace(/\s+$/, "")}\n\`\`\`\n`;
        })
        .join("");
}

/**
 * Turns raw editorial content into self-contained Markdown:
 * - playground iframes become fenced code blocks in `lang` (or every language for "all")
 * - slideshow markers become "[Slide K, frame M]" image references
 * - images become "[Image N]" references
 * Anything that cannot be fetched degrades to a note with its URL.
 */
export async function renderEditorial(
    content: string,
    options: { lang: string; baseUrl: string } & EditorialFetchers
): Promise<RenderedEditorial> {
    const { lang, baseUrl } = options;

    // Playground code
    const uuids = [
        ...new Set([...content.matchAll(PLAYGROUND_IFRAME)].map((m) => m[1]))
    ];
    const codesByUuid = new Map<string, PlaygroundCode[] | null>();
    await Promise.all(
        uuids.map(async (uuid) => {
            try {
                codesByUuid.set(uuid, await options.fetchPlaygroundCodes(uuid));
            } catch (e) {
                logger.error("Failed to fetch playground %s: %s", uuid, e);
                codesByUuid.set(uuid, null);
            }
        })
    );
    let text = content.replace(PLAYGROUND_IFRAME, (_m, uuid: string) => {
        const codes = codesByUuid.get(uuid);
        if (!codes) {
            return `\n> Code could not be fetched: https://leetcode.com/playground/${uuid}/shared\n`;
        }
        return renderCodes(uuid, codes, lang);
    });

    // Images (numbered before slides are expanded so frame URLs are not counted twice)
    const extracted = extractImages(text, baseUrl);
    text = extracted.text;
    const images: ImageRef[] = [...extracted.images];

    // Slideshows
    const markers = [...text.matchAll(SLIDE_MARKER)].map((m) => m[1]);
    const framesByMarker = new Map<string, string[] | null>();
    await Promise.all(
        [...new Set(markers)].map(async (marker) => {
            const stem = parseSlideStem(marker);
            if (!stem) {
                framesByMarker.set(marker, null);
                return;
            }
            try {
                framesByMarker.set(
                    marker,
                    await options.fetchSlideFrames(stem)
                );
            } catch (e) {
                logger.error("Failed to fetch slides %s: %s", stem, e);
                framesByMarker.set(marker, null);
            }
        })
    );
    let slideIndex = 0;
    text = text.replace(SLIDE_MARKER, (_m, marker: string) => {
        slideIndex++;
        const frames = framesByMarker.get(marker);
        if (!frames || frames.length === 0) {
            return `> Slideshow ${slideIndex} could not be fetched (${marker.trim()}).`;
        }
        const labels = frames.map((url, i) => {
            const label = `[Slide ${slideIndex}, frame ${i + 1}]`;
            images.push({ label, url });
            return label;
        });
        return `> Slideshow ${slideIndex} (${frames.length} frames): ${labels.join(" ")}`;
    });

    return { text, images };
}
