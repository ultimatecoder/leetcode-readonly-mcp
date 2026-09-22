import sharp from "sharp";
import logger from "./logger.js";

/** Max width of downscaled images, in pixels. */
export const IMAGE_MAX_WIDTH = 800;
const JPEG_QUALITY = 80;
const DOWNLOAD_CONCURRENCY = 6;

/** Only images hosted by LeetCode are downloaded. */
const ALLOWED_IMAGE_HOSTS = [
    /^(.+\.)?leetcode\.com$/,
    /^s3-lc-upload\.s3\.amazonaws\.com$/
];

export interface ImageContent {
    type: "image";
    data: string;
    mimeType: string;
}

export interface ImageRef {
    /** Marker placed in the text where the image was, e.g. "[Image 2]". */
    label: string;
    url: string;
}

export interface ExtractedImages {
    text: string;
    images: ImageRef[];
}

const FIGURES_BASE_URL =
    "https://assets.leetcode.com/static_assets/media/original_images/";

/**
 * Resolves an image path found in LeetCode content to an absolute URL.
 * Relative editorial figures ("../Figures/94/x.png") live under original_images.
 */
export function resolveAssetUrl(rawUrl: string, baseUrl: string): string {
    const trimmed = rawUrl.trim();
    if (!/^[a-z]+:\/\//i.test(trimmed)) {
        const figure = /(?:^|\/)Figures\/(.+)$/i.exec(trimmed);
        if (figure) {
            return FIGURES_BASE_URL + figure[1];
        }
    }
    return new URL(trimmed, baseUrl).toString();
}

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Replaces Markdown and HTML images in `text` with "[Image N]" markers and
 * returns the resolved image URLs in marker order.
 *
 * @param text - Markdown (may contain inline HTML)
 * @param baseUrl - Base for resolving relative image paths
 * @param startIndex - Number of the first marker
 */
export function extractImages(
    text: string,
    baseUrl: string,
    startIndex: number = 1
): ExtractedImages {
    const images: ImageRef[] = [];
    const add = (rawUrl: string, alt: string): string => {
        let url: string;
        try {
            url = resolveAssetUrl(rawUrl, baseUrl);
        } catch {
            return alt ? `[Image: ${alt}]` : "";
        }
        const label = `[Image ${startIndex + images.length}]`;
        images.push({ label, url });
        return alt ? `${label} (${alt})` : label;
    };
    const withoutMarkdown = text.replace(MARKDOWN_IMAGE, (_m, alt, url) =>
        add(url, alt)
    );
    const withoutHtml = withoutMarkdown.replace(HTML_IMAGE, (tag, url) => {
        const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
        return add(url, alt);
    });
    return { text: withoutHtml, images };
}

export function isAllowedImageUrl(url: string): boolean {
    try {
        const { protocol, hostname } = new URL(url);
        return (
            protocol === "https:" &&
            ALLOWED_IMAGE_HOSTS.some((pattern) => pattern.test(hostname))
        );
    } catch {
        return false;
    }
}

/**
 * Downloads an image and downscales it to a JPEG of at most IMAGE_MAX_WIDTH wide.
 * SVG and GIF are rasterized (first frame for animated GIFs).
 */
export async function downloadImage(url: string): Promise<ImageContent> {
    if (!isAllowedImageUrl(url)) {
        throw new Error(`Image host not allowed: ${url}`);
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    if (res.url && !isAllowedImageUrl(res.url)) {
        throw new Error(
            `Image redirected to a host that is not allowed: ${res.url}`
        );
    }
    const input = Buffer.from(await res.arrayBuffer());
    const output = await sharp(input)
        .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    return {
        type: "image",
        data: output.toString("base64"),
        mimeType: "image/jpeg"
    };
}

/**
 * Downloads images with bounded concurrency. Failed downloads yield null.
 */
export async function downloadImages(
    refs: ImageRef[]
): Promise<(ImageContent | null)[]> {
    const results: (ImageContent | null)[] = new Array(refs.length).fill(null);
    let next = 0;
    const worker = async () => {
        while (next < refs.length) {
            const index = next++;
            try {
                results[index] = await downloadImage(refs[index].url);
            } catch (e) {
                logger.error(
                    "Failed to download image %s: %s",
                    refs[index].url,
                    e
                );
            }
        }
    };
    await Promise.all(
        Array.from(
            { length: Math.min(DOWNLOAD_CONCURRENCY, refs.length) },
            worker
        )
    );
    return results;
}

/**
 * Downloads the images and builds MCP content blocks: each image is preceded by
 * a text block carrying its marker so the model can match it to the text.
 * Images that could not be downloaded are listed with their URL instead.
 */
export async function buildImageContent(
    refs: ImageRef[]
): Promise<Array<{ type: "text"; text: string } | ImageContent>> {
    const downloaded = await downloadImages(refs);
    const content: Array<{ type: "text"; text: string } | ImageContent> = [];
    refs.forEach((ref, index) => {
        const image = downloaded[index];
        if (image) {
            content.push({ type: "text", text: ref.label });
            content.push(image);
        } else {
            content.push({
                type: "text",
                text: `${ref.label} could not be downloaded: ${ref.url}`
            });
        }
    });
    return content;
}
