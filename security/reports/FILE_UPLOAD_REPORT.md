# File Upload Security Report

## Status: PASS

## Findings

1. **Avatar Upload Mechanism:**
   - Avatar uploads (`AvatarUploader.jsx`, `avatarUpload.js`) bypass the Express server completely: images are sent directly from the user's browser to Supabase Storage (`avatars` bucket).
   - The Express application has no file upload endpoints, uses no `multer` or `formidable` middleware, and never writes uploaded files to local disk.

2. **File Size & Type Constraints:**
   - Client validates file size (maximum 5 MB) and MIME types (`image/jpeg`, `image/png`, `image/webp`).
   - Browser re-encodes and centre-crops the image onto an HTML5 canvas to a 512x512 WebP/JPEG blob (`compressAvatar`), stripping unparsed file content and EXIF metadata.
   - Storage bucket definition (`006_create_avatars_storage.sql`) enforces server-side limits:
     `file_size_limit = 5242880`, `allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']`.

3. **Storage Isolation & Access Control:**
   - Files are stored on a separate storage domain (`https://<project-ref>.supabase.co/storage/v1/object/public/avatars/...`), isolated from the application origin.
   - File paths are generated with timestamped names inside the user's own directory: `<userId>/<timestamp>.<ext>`.
   - Row Level Security on `storage.objects` enforces that authenticated users can only write, update, or delete files where `(storage.foldername(name))[1] = auth.uid()::text`.

## What's at risk
Unrestricted file uploads could lead to remote code execution, storage exhaustion, or server-side script execution on the application domain.

## What's already secure
- Uploads go directly to Supabase Storage on an isolated domain.
- Canvas re-encoding normalizes binary image data.
- Strict MIME type and size checks at both client and storage bucket layers.
- Storage RLS restricts writes to user-owned folders only.

## Recommendations
- Maintain current direct-to-cloud storage pattern and RLS storage policies.
