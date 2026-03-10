
-- Fix Sydney Harbour → YouTube live 24/7
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/5uZa3-RMFos?autoplay=1&mute=1',
  youtube_video_id = '5uZa3-RMFos',
  original_url = 'https://www.youtube.com/watch?v=5uZa3-RMFos',
  source_name = 'WebcamSydney',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = '44f0bade-36be-4494-bab6-fb6778c7620e';

-- Fix Madrid Puerta del Sol → YouTube
UPDATE cameras SET 
  embed_url = 'https://www.youtube.com/embed/nMdoQfVbcTU?autoplay=1&mute=1',
  youtube_video_id = 'nMdoQfVbcTU',
  original_url = 'https://www.youtube.com/watch?v=nMdoQfVbcTU',
  source_name = 'YouTube Live',
  status = 'active', is_active = true, failure_count = 0,
  error_message = NULL, verification_status = 'verified'
WHERE id = 'd974622b-a461-4ecd-80af-fadaf9a1c1b3';
