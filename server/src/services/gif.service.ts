import { GifItemDto } from '@webchat/shared';

export interface CuratedGifItem extends GifItemDto {
  tags: string[];
}

export const CURATED_GIFS: CuratedGifItem[] = [
  {
    id: 'happy-dance-1',
    title: 'Happy Dance',
    url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/200w.gif',
    width: 480,
    height: 480,
    tags: ['happy', 'dance', 'excited', 'celebrate', 'fun', 'joy'],
  },
  {
    id: 'thumbs-up-2',
    title: 'Thumbs Up Approval',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif',
    width: 480,
    height: 270,
    tags: ['thumbs up', 'yes', 'agree', 'cool', 'ok', 'good', 'approved'],
  },
  {
    id: 'cat-typing-3',
    title: 'Cat Typing Fast',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
    width: 480,
    height: 360,
    tags: ['cat', 'coding', 'typing', 'work', 'busy', 'computer', 'developer'],
  },
  {
    id: 'popcorn-eating-4',
    title: 'Eating Popcorn Drama',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
    width: 480,
    height: 270,
    tags: ['popcorn', 'drama', 'watching', 'movie', 'waiting', 'fun'],
  },
  {
    id: 'high-five-5',
    title: 'High Five Celebration',
    url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/200w.gif',
    width: 480,
    height: 270,
    tags: ['high five', 'team', 'good job', 'celebrate', 'friends', 'win'],
  },
  {
    id: 'mind-blown-6',
    title: 'Mind Blown',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
    width: 480,
    height: 270,
    tags: ['mind blown', 'wow', 'shock', 'boom', 'amazing', 'crazy'],
  },
  {
    id: 'excited-kid-7',
    title: 'Yes Excited Celebration',
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200w.gif',
    width: 480,
    height: 270,
    tags: ['yes', 'excited', 'success', 'happy', 'win', 'hooray'],
  },
  {
    id: 'cute-cat-8',
    title: 'Cute Cat Eyes',
    url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/200w.gif',
    width: 480,
    height: 360,
    tags: ['cat', 'cute', 'please', 'love', 'kitty', 'eyes'],
  },
  {
    id: 'confused-travolta-9',
    title: 'Confused John Travolta',
    url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200w.gif',
    width: 480,
    height: 204,
    tags: ['confused', 'lost', 'where', 'travolta', 'what', 'question'],
  },
  {
    id: 'dog-tilt-10',
    title: 'Dog Head Tilt Curious',
    url: 'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/13CoXDiaCcCoyk/200w.gif',
    width: 480,
    height: 270,
    tags: ['dog', 'confused', 'cute', 'what', 'curious', 'tilt'],
  },
  {
    id: 'applause-clapping-11',
    title: 'Standing Ovation Applause',
    url: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l41lI4bYmcsPJX9Go/200w.gif',
    width: 480,
    height: 270,
    tags: ['applause', 'clapping', 'bravo', 'clap', 'proud', 'respect'],
  },
  {
    id: 'dramatic-crying-12',
    title: 'Dramatic Crying Sad',
    url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/d2lcHJTG5Tscg/200w.gif',
    width: 480,
    height: 270,
    tags: ['crying', 'sad', 'tears', 'upset', 'no', 'grief'],
  },
  {
    id: 'cat-vibing-13',
    title: 'Cat Vibing Head Bob',
    url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/200w.gif',
    width: 480,
    height: 270,
    tags: ['cat', 'vibe', 'music', 'dance', 'chill', 'meme', 'groove'],
  },
  {
    id: 'this-is-fine-14',
    title: 'This Is Fine Fire',
    url: 'https://media.giphy.com/media/QMHoU66Jx56344994t/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/QMHoU66Jx56344994t/200w.gif',
    width: 480,
    height: 270,
    tags: ['fire', 'this is fine', 'okay', 'stress', 'meme', 'chaos'],
  },
  {
    id: 'laughing-hard-15',
    title: 'Laughing Out Loud',
    url: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/200w.gif',
    width: 480,
    height: 270,
    tags: ['laugh', 'lol', 'funny', 'haha', 'hilarious', 'rofl'],
  },
  {
    id: 'cat-wink-16',
    title: 'Cat Friendly Wink',
    url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/ICOgUNjpvO0PC/200w.gif',
    width: 480,
    height: 270,
    tags: ['wink', 'cat', 'cool', 'friendly', 'flirt', 'smart'],
  },
  {
    id: 'dance-party-17',
    title: 'Dance Party Groove',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
    width: 480,
    height: 270,
    tags: ['dance', 'party', 'disco', 'fun', 'groove', 'club'],
  },
  {
    id: 'blinking-guy-18',
    title: 'Blinking Surprised Guy',
    url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/200w.gif',
    width: 480,
    height: 270,
    tags: ['blinking', 'surprise', 'what', 'shocked', 'speechless', 'meme'],
  },
  {
    id: 'cheering-minions-19',
    title: 'Cheering Minions Party',
    url: 'https://media.giphy.com/media/3oEduSbS314vEsLRe8/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3oEduSbS314vEsLRe8/200w.gif',
    width: 480,
    height: 270,
    tags: ['cheer', 'happy', 'celebrate', 'minions', 'hooray', 'yay'],
  },
  {
    id: 'thinking-loading-20',
    title: 'Thinking Calculating Math',
    url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200w.gif',
    width: 480,
    height: 270,
    tags: ['thinking', 'loading', 'math', 'confused', 'calculate', 'brain'],
  },
  {
    id: 'party-parrot-21',
    title: 'Party Parrot Rave',
    url: 'https://media.giphy.com/media/citBl9yPwnUgg/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/citBl9yPwnUgg/200w.gif',
    width: 480,
    height: 270,
    tags: ['party', 'parrot', 'rave', 'dance', 'fun', 'colorful'],
  },
  {
    id: 'facepalm-22',
    title: 'Facepalm Sigh',
    url: 'https://media.giphy.com/media/3og0INyCmHlNylks9O/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3og0INyCmHlNylks9O/200w.gif',
    width: 480,
    height: 270,
    tags: ['facepalm', 'smh', 'fail', 'oops', 'disappointed', 'sigh'],
  },
  {
    id: 'hello-wave-23',
    title: 'Friendly Hello Wave',
    url: 'https://media.giphy.com/media/m9eG1qVjvNINLFtg24/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/m9eG1qVjvNINLFtg24/200w.gif',
    width: 480,
    height: 270,
    tags: ['hello', 'hi', 'wave', 'greeting', 'welcome', 'hey'],
  },
  {
    id: 'mic-drop-24',
    title: 'Mic Drop Victory',
    url: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/200w.gif',
    width: 480,
    height: 270,
    tags: ['mic drop', 'win', 'done', 'boom', 'cool', 'victory'],
  },
  {
    id: 'love-heart-25',
    title: 'Heart Eyes In Love',
    url: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/200w.gif',
    width: 480,
    height: 270,
    tags: ['love', 'heart', 'crush', 'cute', 'sweet', 'kiss'],
  },
  {
    id: 'sleepy-snooze-26',
    title: 'Sleepy Goodnight Snooze',
    url: 'https://media.giphy.com/media/mguPrVJAnEHIY/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/mguPrVJAnEHIY/200w.gif',
    width: 480,
    height: 270,
    tags: ['sleepy', 'tired', 'bed', 'night', 'yawn', 'sleep'],
  },
  {
    id: 'thank-you-27',
    title: 'Thank You Grateful Bow',
    url: 'https://media.giphy.com/media/Ripnet478mUpq/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/Ripnet478mUpq/200w.gif',
    width: 480,
    height: 270,
    tags: ['thank you', 'thanks', 'grateful', 'appreciate', 'bow', 'kind'],
  },
];

function sanitizeGifDto(item: CuratedGifItem): GifItemDto {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    previewUrl: item.previewUrl,
    width: item.width,
    height: item.height,
  };
}

export async function fetchTrendingGifs(limit = 20): Promise<GifItemDto[]> {
  const giphyKey = process.env.GIPHY_API_KEY;
  if (giphyKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=${limit}&rating=g`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (Array.isArray(data?.data) && data.data.length > 0) {
          return data.data.map((item: any) => ({
            id: item.id,
            title: item.title || 'Trending GIF',
            url: item.images?.original?.url || item.images?.downsized?.url || item.url,
            previewUrl: item.images?.fixed_width?.url || item.images?.downsized?.url || item.url,
            width: parseInt(item.images?.original?.width || '480', 10),
            height: parseInt(item.images?.original?.height || '270', 10),
          }));
        }
      }
    } catch {
      // Fall through to curated fallback on network or API failure
    }
  }

  return CURATED_GIFS.slice(0, limit).map(sanitizeGifDto);
}

export async function searchGifs(query: string, limit = 20): Promise<GifItemDto[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return fetchTrendingGifs(limit);
  }

  const giphyKey = process.env.GIPHY_API_KEY;
  if (giphyKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(trimmed)}&limit=${limit}&rating=g`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (Array.isArray(data?.data) && data.data.length > 0) {
          return data.data.map((item: any) => ({
            id: item.id,
            title: item.title || trimmed,
            url: item.images?.original?.url || item.images?.downsized?.url || item.url,
            previewUrl: item.images?.fixed_width?.url || item.images?.downsized?.url || item.url,
            width: parseInt(item.images?.original?.width || '480', 10),
            height: parseInt(item.images?.original?.height || '270', 10),
          }));
        }
      }
    } catch {
      // Fall through to curated fallback on network or API failure
    }
  }

  // Filter curated collection by keywords/title
  const matched = CURATED_GIFS.filter((gif) => {
    if (gif.title.toLowerCase().includes(trimmed)) return true;
    return gif.tags.some((tag) => tag.toLowerCase().includes(trimmed) || trimmed.includes(tag.toLowerCase()));
  });

  if (matched.length > 0) {
    return matched.slice(0, limit).map(sanitizeGifDto);
  }

  // If no match found in curated keywords, return curated trending subset so user always has options
  return CURATED_GIFS.slice(0, Math.min(limit, 8)).map(sanitizeGifDto);
}
