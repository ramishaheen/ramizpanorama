-- Update cameras with working YouTube live embed URLs
-- Saudi Arabia - Mecca
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/ifv7lAPcUFA?autoplay=1&mute=1', status = 'active' WHERE name = 'Mecca Masjid al-Haram Live';
-- Saudi Arabia - Medina
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/Yrc3rljIuRw?autoplay=1&mute=1', status = 'active' WHERE name = 'Medina Masjid an-Nabawi';

-- Replace non-working embed_page cameras with YouTube live streams where available
-- Jordan - Amman
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/CjuP8wJQKrc?autoplay=1&mute=1', source_name = 'YouTube Live' WHERE name = 'Amman City Center - Live';
-- Dubai Marina
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/k1cD-D0cJZ4?autoplay=1&mute=1', source_name = 'YouTube Live' WHERE name = 'Dubai Marina Skyline';
-- Burj Khalifa
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/K55S1YiGkOE?autoplay=1&mute=1', source_name = 'YouTube Live' WHERE name = 'Burj Khalifa Live';
-- Doha
UPDATE cameras SET embed_url = 'https://www.youtube.com/embed/YTLGLjfOMIU?autoplay=1&mute=1', source_name = 'YouTube Live' WHERE name = 'Doha Skyline';

-- Add more YouTube live cameras for countries that need them
INSERT INTO cameras (country, city, name, category, source_type, source_name, embed_url, lat, lng, is_active, status)
VALUES
  ('Israel', 'Jerusalem', 'Western Wall Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/P4m7no-HMao?autoplay=1&mute=1', 31.7767, 35.2345, true, 'active'),
  ('Israel', 'Tel Aviv', 'Tel Aviv Beach Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/Rz3vIbqaZJg?autoplay=1&mute=1', 32.0853, 34.7818, true, 'active'),
  ('Turkey', 'Istanbul', 'Istanbul Bosphorus Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/vb2nWm6W_YQ?autoplay=1&mute=1', 41.0082, 28.9784, true, 'active'),
  ('Turkey', 'Istanbul', 'Hagia Sophia Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/WOKg8R6gRlI?autoplay=1&mute=1', 41.0086, 28.9802, true, 'active'),
  ('Egypt', 'Cairo', 'Pyramids of Giza Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/DLQxYOBJxjA?autoplay=1&mute=1', 29.9792, 31.1342, true, 'active'),
  ('Egypt', 'Cairo', 'Cairo Nile River Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/mTD3hpcdag0?autoplay=1&mute=1', 30.0444, 31.2357, true, 'active'),
  ('Lebanon', 'Beirut', 'Beirut Port Live', 'ports', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/UWBd2JKgGGw?autoplay=1&mute=1', 33.9016, 35.5126, true, 'active'),
  ('Iraq', 'Baghdad', 'Baghdad City View', 'public', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/jBXQHyHaLvE?autoplay=1&mute=1', 33.3152, 44.3661, true, 'active'),
  ('Kuwait', 'Kuwait City', 'Kuwait Towers Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/xHvFHMlNITE?autoplay=1&mute=1', 29.3917, 47.9906, true, 'active'),
  ('Iran', 'Tehran', 'Tehran Milad Tower View', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/Z_VwGK1xDLs?autoplay=1&mute=1', 35.7448, 51.3753, true, 'active'),
  ('Bahrain', 'Manama', 'Bahrain World Trade Center', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/4pHkEF7DJAE?autoplay=1&mute=1', 26.2285, 50.5860, true, 'active'),
  ('Oman', 'Muscat', 'Muscat Corniche Live', 'tourism', 'embed_page', 'YouTube Live', 'https://www.youtube.com/embed/RKcPNTqNGKM?autoplay=1&mute=1', 23.5880, 58.3829, true, 'active')
ON CONFLICT DO NOTHING;