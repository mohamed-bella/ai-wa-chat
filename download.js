// download.js
const fs = require('fs-extra');
const path = require('path');
const ytdl = require('@distube/ytdl-core'); // Using @distube/ytdl-core

/**
 * YouTubeDownloader class using @distube/ytdl-core for reliable YouTube downloads.
 * This class includes detailed logging for debugging and clearer error messages.
 */
class YouTubeDownloader {
    constructor() {
        this.downloadPath = './downloads';
        fs.ensureDirSync(this.downloadPath);
        console.log('[YouTubeDownloader] Initialized. Downloads will be saved to:', this.downloadPath);
    }

    /**
     * Checks if the given URL is a valid YouTube video URL using @distube/ytdl-core validation.
     * @param {string} url - The YouTube URL to validate.
     * @returns {boolean} True if valid, false otherwise.
     */
    isValidUrl(url) {
        const valid = ytdl.validateURL(url);
        console.log('[isValidUrl] URL:', url, 'IsValid:', valid);
        return valid;
    }

    /**
     * Convert a duration in seconds to a MM:SS format string.
     * @param {number} seconds - Duration in seconds.
     * @returns {string} Formatted duration as "MM:SS".
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Downloads a YouTube video from the given URL.
     * Detailed logging is provided at each step. Returns a promise that resolves with video info or rejects with an error object.
     * @param {string} url - The YouTube video URL to download.
     * @returns {Promise<object>} A promise that resolves with an object containing download info.
     */
    async download(url) {
        console.log('[download] Starting download process for URL:', url);

        try {
            // Validate URL
            if (!this.isValidUrl(url)) {
                const errMsg = 'Invalid YouTube URL provided.';
                console.error('[download] Error:', errMsg);
                throw new Error(errMsg);
            }

            // Fetch video info
            console.log('[download] Fetching video info...');
            let videoInfo;
            try {
                videoInfo = await ytdl.getInfo(url);
            } catch (infoError) {
                const errMsg = `Failed to retrieve video info: ${infoError.message}`;
                console.error('[download] Error fetching info:', errMsg);
                throw new Error(errMsg);
            }

            if (!videoInfo || !videoInfo.videoDetails) {
                const errMsg = 'Video info is empty or invalid.';
                console.error('[download] Error:', errMsg);
                throw new Error(errMsg);
            }

            const details = videoInfo.videoDetails;
            console.log('[download] Video Details retrieved:', {
                title: details.title,
                channel: details.author?.name,
                durationSec: details.lengthSeconds,
                views: details.viewCount,
                uploadedDate: details.uploadDate
            });

            const safeTitle = details.title.replace(/[^\w\s-]/g, '');
            const filePath = path.join(this.downloadPath, `${safeTitle}.mp4`);
            console.log('[download] File will be saved to:', filePath);

            // Start download
            console.log('[download] Starting video download stream...');
            const videoStream = ytdl(url, {
                quality: 'highest',
                filter: 'audioandvideo'
            });

            const writer = fs.createWriteStream(filePath);

            let downloadCompleted = false;

            return new Promise((resolve, reject) => {
                videoStream.pipe(writer);

                // Listen to 'finish' event on writer
                writer.on('finish', () => {
                    console.log('[download] Download finished:', filePath);
                    downloadCompleted = true;

                    const result = {
                        status: true,
                        path: filePath,
                        filename: `${safeTitle}.mp4`,
                        title: details.title,
                        duration: this.formatDuration(parseInt(details.lengthSeconds, 10)),
                        thumbnail: details.thumbnails && details.thumbnails.length > 0 ? details.thumbnails[0].url : 'No thumbnail available',
                        channel: details.author?.name || 'Unknown',
                        views: details.viewCount ? parseInt(details.viewCount, 10).toLocaleString() : 'Unknown',
                        uploadDate: details.uploadDate || 'Unknown'
                    };

                    console.log('[download] Result:', result);
                    resolve(result);
                });

                // Error events on writer or videoStream
                writer.on('error', (writeErr) => {
                    console.error('[download] WriteStream Error:', writeErr.message);
                    reject({
                        status: false,
                        error: `File write error: ${writeErr.message}`
                    });
                });

                videoStream.on('error', (streamErr) => {
                    console.error('[download] VideoStream Error:', streamErr.message);
                    reject({
                        status: false,
                        error: `Video stream error: ${streamErr.message}`
                    });
                });

                // Add a timeout to prevent infinite wait
                const timeoutMs = 300000; // 5 minutes
                setTimeout(() => {
                    if (!downloadCompleted) {
                        console.error('[download] Download timed out after 5 minutes');
                        writer.destroy();
                        reject({
                            status: false,
                            error: 'Download timed out after 5 minutes'
                        });
                    }
                }, timeoutMs);
            });

        } catch (error) {
            // Wrap error in a consistent response object
            console.error('[download] Caught error:', error.message);
            return Promise.reject({
                status: false,
                error: error.message
            });
        }
    }

    /**
     * Cleanup the given file (delete it from the disk).
     * @param {string} filePath - The path of the file to remove.
     * @returns {Promise<void>}
     */
    async cleanup(filePath) {
        console.log('[cleanup] Attempting to remove file:', filePath);
        try {
            if (fs.existsSync(filePath)) {
                await fs.unlink(filePath);
                console.log('[cleanup] File removed successfully:', filePath);
            } else {
                console.log('[cleanup] File does not exist, no cleanup needed:', filePath);
            }
        } catch (error) {
            console.error('[cleanup] Error removing file:', filePath, error.message);
        }
    }
}

module.exports = new YouTubeDownloader();
