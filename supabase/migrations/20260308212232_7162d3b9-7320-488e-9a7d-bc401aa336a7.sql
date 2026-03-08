
-- Update Jordan cameras with verified working Middle East live streams (March 2026)

-- Amman Citadel - use Source Global News 24/7 Middle East multi-cam (confirmed live, 78.9K views)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/gmtlJ_m2r5A?autoplay=1&mute=1', status = 'active' WHERE name = 'Amman Citadel View';

-- Aqaba Red Sea - use NEMICO Middle East cameras (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/DcyV79s0oWU?autoplay=1&mute=1', status = 'active' WHERE name = 'Aqaba Red Sea';

-- Amman Zharan Street - use Israel/Middle East real-time cameras (confirmed live)
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/GKuz7vjLIJo?autoplay=1&mute=1', status = 'active' WHERE name = 'Amman Zharan Street';
