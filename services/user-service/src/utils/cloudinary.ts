/**
 * Cloudinary SDK — Singleton Configuration
 *
 * Initializes the Cloudinary v2 client using environment variables.
 * Used by the user-service for avatar and media uploads.
 *
 * Required env vars (set in Railway Dashboard → Service → Variables):
 *   CLOUDINARY_CLOUD_NAME  — Your Cloudinary cloud name
 *   CLOUDINARY_API_KEY     — API key from Cloudinary Dashboard
 *   CLOUDINARY_API_SECRET  — API secret from Cloudinary Dashboard
 *
 * Usage:
 *   import { cloudinary } from './utils/cloudinary.js';
 *   const result = await cloudinary.uploader.upload(filePath, { folder: 'dravio/avatars' });
 *   const url = result.secure_url;
 */
import { v2 as cloudinaryV2 } from 'cloudinary';

function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'FATAL: Cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, ' +
      'and CLOUDINARY_API_SECRET environment variables. ' +
      'Set these in Railway Dashboard → Service → Variables.'
    );
  }

  cloudinaryV2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true, // Always use HTTPS URLs
  });

  return cloudinaryV2;
}

/**
 * Pre-configured Cloudinary v2 client.
 * Upload options for DRAVIO:
 *   folder:         'dravio/avatars'        — organizes uploads in Cloudinary
 *   resource_type:  'image'                 — accept images only
 *   allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] — whitelist formats
 *   max_bytes:      5 * 1024 * 1024         — 5 MB limit
 *   transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
 */
export const cloudinary = initCloudinary();

/**
 * Cloudinary upload preset configuration for user avatars.
 * Pass this as options to cloudinary.uploader.upload() or upload_stream().
 */
export const AVATAR_UPLOAD_OPTIONS = {
  folder: 'dravio/avatars',
  resource_type: 'image' as const,
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [
    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
} as const;
