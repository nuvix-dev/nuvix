

declare namespace Storage {
    declare interface ObjectMetadata {
        content_type: string;
        size?: number;
        last_modified?: string;
        etag?: string;
        sizeActual?: number;
        signature?: string;
        mimeType: string;
        chunksTotal: number;
        chunksUploaded: number;
    }
}
