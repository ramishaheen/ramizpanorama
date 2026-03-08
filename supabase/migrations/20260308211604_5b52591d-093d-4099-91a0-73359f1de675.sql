
-- Fix malformed YouTube embed URLs and update with verified working live streams
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/MfIpyflPbHQ?autoplay=1&mute=1' WHERE name = 'Dubai Marina';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/QTTTY_ra2Tg?autoplay=1&mute=1' WHERE name = 'Times Square NYC';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/gmtlJ_m2r5A?autoplay=1&mute=1' WHERE name ILIKE '%Moscow Red Square%';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/DcyV79s0oWU?autoplay=1&mute=1' WHERE name ILIKE '%Moscow Traffic%';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/gmtlJ_m2r5A?autoplay=1&mute=1' WHERE name ILIKE '%St Petersburg%';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/GKuz7vjLIJo?autoplay=1&mute=1' WHERE name ILIKE '%Kyiv%';
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/JXl8FsriOs0?autoplay=1&mute=1' WHERE name ILIKE '%Tel Aviv%';

-- Fix ALL malformed URLs that have &param before ? by extracting video ID and rebuilding
UPDATE cameras SET embed_url = regexp_replace(embed_url, 
  'https://www\.youtube\.com/embed/([A-Za-z0-9_-]+)&[^?]*\?.*', 
  'https://www.youtube.com/embed/\1?autoplay=1&mute=1')
WHERE embed_url LIKE '%youtube.com/embed/%&%?%';

-- Fix live_stream format URLs  
UPDATE cameras SET embed_url = NULL, status = 'inactive' 
WHERE embed_url LIKE '%live_stream?channel=%';
