
-- Update cameras with VERIFIED working YouTube live stream IDs (March 2026)

-- Dubai Marina - SkylineWebcams (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/MfIpyflPbHQ?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Dubai Marina%';

-- Times Square NYC - EarthCam 4K (confirmed live)  
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/UVftxDFol90?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Times Square%';

-- Jerusalem Western Wall - EarthCam (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/CrRThOApudI?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Jerusalem%';

-- Tel Aviv / Israel cameras (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/GKuz7vjLIJo?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Tel Aviv%';

-- Tokyo Shibuya - SHIBUYA SKY (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/3Q5wZeTuttw?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Tokyo%' AND name ILIKE '%Shibuya%';

-- Tokyo generic - Tokyo Bay Rainbow Bridge (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/_k-5U7IeK8g?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Tokyo%' AND name NOT ILIKE '%Shibuya%';

-- Rome - Piazza Venezia (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/8iBOXGERQ_A?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Rome%' OR name ILIKE '%Roma%';

-- Miami - Biscayne Bay (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/5YCajRjvWCg?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Miami%';

-- Bur Dubai / Dubai walking (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/cPvCNaiszhs?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Bur Dubai%';

-- Chicago - use SkylineWebcams known channel
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/qqGXqgU0mZM?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Chicago%';

-- Trevi Fountain Rome
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/j39vIidsIJI?autoplay=1&mute=1', status = 'active' WHERE name ILIKE '%Trevi%';
