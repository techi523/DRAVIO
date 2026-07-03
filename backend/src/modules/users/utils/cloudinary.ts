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
    secure: true,
  });

  return cloudinaryV2;
}

export const cloudinary = initCloudinary();

export const AVATAR_UPLOAD_OPTIONS = {
  folder: 'dravio/avatars',
  resource_type: 'image' as const,
  allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [
    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
} as const;
