const HOUR = 3600000;
const DAY = 24 * HOUR;
const DEFAULT_LOCATION = '서울';
const DEFAULT_CACHE_MS = 15 * 60000;
const FAILURE_CACHE_MS = 2 * 60000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const NAVER_ORIGIN = 'https://m.search.naver.com';
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const CONDITIONS = {
  'clear-night': '맑은 밤',
  cloudy: '흐림',
  fog: '안개',
  hail: '우박',
  lightning: '천둥·번개',
  'lightning-rainy': '뇌우',
  partlycloudy: '구름 조금',
  pouring: '강한 비',
  rainy: '비',
  snowy: '눈',
  'snowy-rainy': '눈·비',
  sunny: '맑음',
  windy: '바람',
  'windy-variant': '흐리고 바람',
  exceptional: '특이 기상',
};

export function normalizeWeatherLocation(value) {
  if (typeof value !== 'string') return DEFAULT_LOCATION;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 40 || /[<>&"'\\]/.test(cleaned)) return DEFAULT_LOCATION;
  return cleaned;
}

export function conditionFromKoreanText(text, night = false) {
  if (typeof text !== 'string') return null;
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value) return null;
  if ((value.includes('눈') && value.includes('비')) || value.includes('진눈깨비')) return 'snowy-rainy';
  if (value.includes('천둥') || value.includes('번개') || value.includes('뇌우')) return 'lightning-rainy';
  if (value.includes('우박')) return 'hail';
  if (value.includes('폭우') || value.includes('강한 비')) return 'pouring';
  if (value.includes('눈')) return 'snowy';
  if (value.includes('비') || value.includes('소나기')) return 'rainy';
  if (value.includes('안개') || value.includes('연무') || value.includes('박무') || value.includes('황사')) return 'fog';
  if (value.includes('흐림') || value.includes('흐리고')) return 'cloudy';
  if (value.includes('구름')) return 'partlycloudy';
  if (value === '맑음') return night ? 'clear-night' : 'sunny';
  return null;
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTemperature(text) {
  const match = /[-+]?\d+(?:\.\d+)?/.exec(text);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value >= -50 && value <= 60 ? value : null;
}

function kstDateParts(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const map = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  return { year: map.year, month: map.month, day: map.day };
}

function parseCurrentBlock(html) {
  const start = html.indexOf('<div class="weather_graphic">');
  if (start < 0) return { conditionCode: null, temperatureC: null };
  const slice = html.slice(start, start + 4000);
  const mainMatch = /<div class="weather_main">([\s\S]{0,600}?)<\/div>/i.exec(slice);
  let conditionCode = null;
  if (mainMatch) {
    const iconMatch = /<i\b[^>]*class="([^"]*)"[^>]*>([\s\S]{0,300}?)<\/i>/i.exec(mainMatch[1]);
    if (iconMatch) {
      const night = /\bico_wt2\b/.test(iconMatch[1]);
      conditionCode = conditionFromKoreanText(stripTags(iconMatch[2]), night);
    }
  }
  const tempMatch = /<div class="temperature_text">([\s\S]{0,600}?)<\/div>/i.exec(slice);
  let temperatureC = null;
  if (tempMatch) {
    const cleaned = tempMatch[1].replace(/<span class="blind">[\s\S]*?<\/span>/gi, ' ');
    temperatureC = parseTemperature(stripTags(cleaned));
  }
  return { conditionCode, temperatureC };
}

function parseHourlyItems(html, nowMs) {
  const marker = '<div class="graph_inner _hourly_weather">';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const ulStart = html.indexOf('<ul', start);
  if (ulStart < 0 || ulStart - start > 512) return [];
  const ulEnd = html.indexOf('</ul>', ulStart);
  if (ulEnd < 0 || ulEnd - ulStart > 131072) return [];
  const listHtml = html.slice(ulStart, ulEnd);
  const baseDate = kstDateParts(nowMs);
  const items = [];
  let dayOffset = 0;
  let lastTime = -Infinity;

  const liPattern = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liPattern.exec(listHtml)) !== null && items.length < 48) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const dayAttr = /\bdata-day="(today|tomorrow|after_tomorrow|day_after_tomorrow)"/i.exec(attrs)?.[1]?.toLowerCase();
    if (dayAttr === 'tomorrow') dayOffset = Math.max(dayOffset, 1);
    else if (dayAttr === 'after_tomorrow' || dayAttr === 'day_after_tomorrow') dayOffset = Math.max(dayOffset, 2);

    const timeMatch = /<dt\b[^>]*class="[^"]*\btime\b[^"]*"[^>]*>([\s\S]{0,200}?)<\/dt>/i.exec(body);
    if (!timeMatch) continue;
    const labelText = stripTags(timeMatch[1]);
    const hourMatch = /(\d{1,2})시/.exec(labelText);
    let hour = null;
    if (hourMatch) {
      hour = Number(hourMatch[1]);
    } else if (labelText.includes('모레')) {
      dayOffset = Math.max(dayOffset, 2);
      hour = 0;
    } else if (labelText.includes('내일') || dayAttr === 'tomorrow') {
      dayOffset = Math.max(dayOffset, 1);
      hour = 0;
    }
    if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;

    // Asia/Seoul is fixed UTC+9 with no DST.
    const at = Date.UTC(baseDate.year, baseDate.month - 1, baseDate.day + dayOffset, hour - 9, 0, 0);
    if (!Number.isFinite(at) || at <= lastTime) continue;
    lastTime = at;

    let conditionCode = null;
    const boxMatch = /<dd\b[^>]*class="[^"]*\bweather_box\b[^"]*"[^>]*>([\s\S]{0,400}?)<\/dd>/i.exec(body);
    if (boxMatch) {
      const iconMatch = /<i\b[^>]*class="([^"]*)"[^>]*>([\s\S]{0,250}?)<\/i>/i.exec(boxMatch[1]);
      if (iconMatch) {
        const night = /\bico_wt2\b/.test(iconMatch[1]);
        conditionCode = conditionFromKoreanText(stripTags(iconMatch[2]), night);
      }
    }
    let temperatureC = null;
    const tempMatch = /<span\b[^>]*class="[^"]*\bnum\b[^"]*"[^>]*>([\s\S]{0,120}?)<\/span>/i.exec(body);
    if (tempMatch) {
      temperatureC = parseTemperature(stripTags(tempMatch[1]));
    }
    if (!conditionCode && temperatureC === null) continue;
    items.push({
      time: new Date(at).toISOString(),
      conditionCode,
      condition: conditionCode ? CONDITIONS[conditionCode] : null,
      temperatureC,
      precipitationMm: null,
      precipitationProbability: null,
    });
  }
  return items;
}

export function parseNaverWeatherHtml(html, { location = DEFAULT_LOCATION, now = Date.now() } = {}) {
  if (typeof html !== 'string' || !html) return null;
  const name = normalizeWeatherLocation(location);
  const updatedAt = new Date(now).toISOString();
  const { conditionCode, temperatureC } = parseCurrentBlock(html);
  const hourly = parseHourlyItems(html, now);
  if (!conditionCode && temperatureC === null) return null;
  return {
    weather: {
      available: Boolean(conditionCode || temperatureC !== null),
      conditionCode,
      condition: conditionCode ? CONDITIONS[conditionCode] : null,
      temperatureC,
      name,
      source: '네이버 날씨',
      updatedAt,
    },
    hourly,
    updatedAt,
  };
}

export function naverWeatherUrl(location = DEFAULT_LOCATION) {
  const normalized = normalizeWeatherLocation(location);
  const query = normalized.endsWith('날씨') ? normalized : `${normalized} 날씨`;
  const url = new URL('/search.naver', NAVER_ORIGIN);
  url.search = new URLSearchParams({
    where: 'm',
    sm: 'top_hty',
    fbm: '1',
    ie: 'utf8',
    query,
  }).toString();
  return url.href;
}

export function createNaverWeather({
  location = DEFAULT_LOCATION,
  fetchImpl = fetch,
  now = Date.now,
  cacheMs = DEFAULT_CACHE_MS,
} = {}) {
  const normalizedLocation = normalizeWeatherLocation(location);
  let cache = null;
  let pending = null;

  function project(snapshot) {
    if (!snapshot) return null;
    const hour = Math.floor(now() / HOUR) * HOUR;
    const items = snapshot.hourly
      .filter(item => {
        const at = Date.parse(item.time);
        return at >= hour && at < hour + DAY;
      })
      .slice(0, 8);
    return {
      weather: snapshot.weather,
      forecast: {
        available: items.length > 0,
        source: '네이버 날씨',
        updatedAt: items.length > 0 ? snapshot.updatedAt : null,
        items,
      },
    };
  }

  return {
    location: normalizedLocation,
    async read() {
      const currentTime = now();
      if (cache && currentTime < cache.expires) return project(cache.value);
      if (pending) return project(await pending);
      pending = (async () => {
        try {
          const response = await fetchImpl(naverWeatherUrl(normalizedLocation), {
            redirect: 'error',
            signal: AbortSignal.timeout(8000),
            headers: {
              'User-Agent': USER_AGENT,
              'Accept-Language': 'ko-KR,ko;q=0.9',
            },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const html = await response.text();
          if (html.length > MAX_HTML_BYTES) throw new Error('Response too large');
          const parsed = parseNaverWeatherHtml(html, { location: normalizedLocation, now: now() });
          if (!parsed) throw new Error('Naver weather unavailable');
          cache = { value: parsed, expires: now() + cacheMs };
          return parsed;
        } catch {
          cache = { value: null, expires: now() + FAILURE_CACHE_MS };
          return null;
        } finally {
          pending = null;
        }
      })();
      return project(await pending);
    },
  };
}
