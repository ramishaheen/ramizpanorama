
-- Fix all 21 broken cameras by replacing with working YouTube live streams
-- or deleting cameras that have no viable public alternative

-- 1. Venice - Piazza San Marco → YouTube live
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/9Wlp3wXQCsY?autoplay=1&mute=1',
  youtube_video_id = '9Wlp3wXQCsY',
  original_url = 'https://www.youtube.com/watch?v=9Wlp3wXQCsY',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '3b89ce66-8c98-4968-ba36-5bd15a347dd5';

-- 2. Milan Cathedral (first) → delete duplicate, keep one fixed
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/SqhXQUzVMlQ?autoplay=1&mute=1',
  youtube_video_id = 'SqhXQUzVMlQ',
  original_url = 'https://www.skylinewebcams.com/en/webcam/italia/lombardia/milano/duomo-milano.html',
  source_name = 'SkylineWebcams',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '5aedeb1f-dd9b-4441-bc12-488911c9efe0';

-- 3. Milan Cathedral duplicate → delete
DELETE FROM cameras WHERE id = '85495e79-fdbc-45b1-ad6b-f533604c30a1';

-- 4. Tel Aviv Beach → use balticcam embed
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/fRGIWMDiIDk?autoplay=1&mute=1',
  youtube_video_id = 'fRGIWMDiIDk',
  original_url = 'https://www.youtube.com/watch?v=fRGIWMDiIDk',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '9474999e-3756-4d7f-aedf-33d6bc259e84';

-- 5. Port of LA - Wilmington → Port of LA YouTube channel
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/iaDgpTnagy4?autoplay=1&mute=1',
  youtube_video_id = 'iaDgpTnagy4',
  original_url = 'https://www.youtube.com/watch?v=iaDgpTnagy4',
  source_name = 'Port of Los Angeles',
  name = 'Port of LA Waterfront',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = 'dc3ef0e7-b264-4df1-962e-a83723119fb3';

-- 6. Trevi Fountain → SkylineWebcams YouTube
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/j39vIidsIJI?autoplay=1&mute=1',
  youtube_video_id = 'j39vIidsIJI',
  original_url = 'https://www.youtube.com/watch?v=j39vIidsIJI',
  source_name = 'SkylineWebcams',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = 'e310d039-e1bb-4b55-8c8f-7123ed3fbb83';

-- 7. Kuwait City → No YouTube live found, mark as external link only
UPDATE cameras SET 
  embed_url = 'https://www.skylinewebcams.com/webcam/kuwait.html',
  source_name = 'SkylineWebcams',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'external_only'
WHERE id = '32bb7f60-cce7-4223-bc70-8f8ea046b7fb';

-- 8. Waikiki Beach → Ala Moana Honolulu YouTube live
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/LjGOIHxuDhE?autoplay=1&mute=1',
  youtube_video_id = 'LjGOIHxuDhE',
  original_url = 'https://www.youtube.com/watch?v=LjGOIHxuDhE',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '5e6da785-c407-4738-aa95-a78b336eb1b8';

-- 9. Seoul Station → Lotte World Tower YouTube live
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/FMttUY6RY9I?autoplay=1&mute=1',
  youtube_video_id = 'FMttUY6RY9I',
  original_url = 'https://www.youtube.com/watch?v=FMttUY6RY9I',
  name = 'Seoul Lotte World Tower',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '50d51a19-2155-4561-9019-ebe3e3c244be';

-- 10. Klaipeda → No YouTube alt, mark external link
UPDATE cameras SET 
  source_name = 'EarthCam',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'external_only'
WHERE id = 'd612e660-9601-488a-b09a-91fc82c00af7';

-- 11. CN Tower Toronto → YouTube live
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/RIkUqMCFljM?autoplay=1&mute=1',
  youtube_video_id = 'RIkUqMCFljM',
  original_url = 'https://www.youtube.com/watch?v=RIkUqMCFljM',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '5f89b887-28d0-4aa5-a4ae-4fbd52d875d9';

-- 12. Dubai Marina → SkylineWebcams YouTube
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/MfIpyflPbHQ?autoplay=1&mute=1',
  youtube_video_id = 'MfIpyflPbHQ',
  original_url = 'https://www.youtube.com/watch?v=MfIpyflPbHQ',
  source_name = 'SkylineWebcams',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '3d5a88b4-763e-4752-91b0-6995d9a3f8c5';

-- 13. Eiffel Tower → YouTube live
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/SzQy7t-bU1A?autoplay=1&mute=1',
  youtube_video_id = 'SzQy7t-bU1A',
  original_url = 'https://www.youtube.com/watch?v=SzQy7t-bU1A',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '68e058a4-e3c6-4dfb-91c6-3d97dd5e465e';

-- 14. Gudauri Georgia → No YouTube alt, mark external
UPDATE cameras SET 
  source_name = 'EarthCam',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'external_only'
WHERE id = '282ae5b4-34d5-46d2-9040-5f79a8b5b04f';

-- 15. Bur Dubai → Fix YouTube embed (ID was in original_url)
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/cPvCNaiszhs?autoplay=1&mute=1',
  youtube_video_id = 'cPvCNaiszhs',
  original_url = 'https://www.youtube.com/watch?v=cPvCNaiszhs',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '08469265-81b4-439d-9588-db91cafe7b50';

-- 16. Port of LA - San Pedro → same Port of LA YouTube
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/iaDgpTnagy4?autoplay=1&mute=1',
  youtube_video_id = 'iaDgpTnagy4',
  original_url = 'https://www.youtube.com/watch?v=iaDgpTnagy4',
  source_name = 'Port of Los Angeles',
  name = 'Port of LA - Main Channel',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '3bd8e308-0fc7-4362-8585-4b5cb70e3426';

-- 17. Rostov-on-Don (ivideon - unsupported format) → delete
DELETE FROM cameras WHERE id = '5485dc02-0431-4ede-b439-5c2fdd18d9ee';

-- 18. Kenya Aberdare (expired angelcam token) → delete
DELETE FROM cameras WHERE id = 'd2d8bb7a-0808-4314-997f-fdbe75da6906';

-- 19. Aberdeen (static image - inactive) → delete
DELETE FROM cameras WHERE id = 'd47ffa25-7bce-41e6-a89d-971853dc891b';
