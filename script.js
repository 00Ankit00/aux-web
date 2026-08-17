/* ---------------- shared state ---------------- */

let weatherState = null; // { tempF, tempC, text, icon }
let useCelsius = true;
let clockTimeZone = 'Asia/Kolkata'; // defaults to India until a real location resolves

/* ---------------- clock ---------------- */

const clockTimeEl = document.getElementById('clockTime');
const clockDateEl = document.getElementById('clockDate');
const daypartLabelEl = document.getElementById('daypartLabel');
const greetingHeadlineEl = document.getElementById('greetingHeadline');
const greetingSubEl = document.getElementById('greetingSub');

const DAYPARTS = [
  { start: 0, end: 5, label: 'LATE NIGHT · CHILL SET', head: 'rain on the window, r&b in the room.' },
  { start: 5, end: 8, label: 'DAWN · SLOW WAKE', head: 'first light, still half asleep.' },
  { start: 8, end: 12, label: 'MORNING · SOFT START', head: 'grey sky, warm speakers, easy morning.' },
  { start: 12, end: 17, label: 'AFTERNOON · LOW KEY', head: 'rain hasn’t let up, neither has the playlist.' },
  { start: 17, end: 20, label: 'DUSK · WIND DOWN', head: 'lights on early, streets going quiet.' },
  { start: 20, end: 24, label: 'NIGHT · DEEP CUTS', head: 'wet streets, low light, the good tracks come out.' },
];

function getDaypart(hour) {
  return DAYPARTS.find(d => hour >= d.start && hour < d.end) || DAYPARTS[0];
}

function getZonedHM(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return { h, m };
}

let currentDaypartLabel = null;

function updateClock() {
  const { h: h24, m } = getZonedHM(clockTimeZone);
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 || 12;
  clockTimeEl.textContent = `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  clockDateEl.textContent = new Intl.DateTimeFormat('en-US', {
    timeZone: clockTimeZone, weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date());

  const dp = getDaypart(h24);
  if (dp.label !== currentDaypartLabel) {
    currentDaypartLabel = dp.label;
    daypartLabelEl.textContent = dp.label;
    greetingHeadlineEl.textContent = dp.head;
    updateGreetingSub();
  }
}

updateClock();
setInterval(updateClock, 1000 * 15);

/* ---------------- weather ---------------- */

const weatherTempEl = document.getElementById('weatherTemp');
const weatherLocationEl = document.getElementById('weatherLocation');
const weatherIconEl = document.getElementById('weatherIcon');

const WEATHER_CODES = {
  0: ['clear', '☀︎'],
  1: ['mostly clear', '\u{1F324}︎'],
  2: ['partly cloudy', '⛅︎'],
  3: ['overcast', '☁︎'],
  45: ['foggy', '\u{1F32B}︎'],
  48: ['icy fog', '\u{1F32B}︎'],
  51: ['light drizzle', '\u{1F326}︎'],
  53: ['drizzle', '\u{1F326}︎'],
  55: ['heavy drizzle', '\u{1F327}︎'],
  56: ['freezing drizzle', '\u{1F327}︎'],
  57: ['freezing drizzle', '\u{1F327}︎'],
  61: ['light rain', '\u{1F327}︎'],
  63: ['rain', '\u{1F327}︎'],
  65: ['heavy rain', '\u{1F327}︎'],
  66: ['freezing rain', '\u{1F327}︎'],
  67: ['freezing rain', '\u{1F327}︎'],
  71: ['light snow', '❄︎'],
  73: ['snow', '❄︎'],
  75: ['heavy snow', '❄︎'],
  77: ['snow grains', '❄︎'],
  80: ['rain showers', '\u{1F326}︎'],
  81: ['rain showers', '\u{1F327}︎'],
  82: ['heavy showers', '\u{1F327}︎'],
  85: ['snow showers', '❄︎'],
  86: ['snow showers', '❄︎'],
  95: ['thunderstorm', '⛈︎'],
  96: ['thunderstorm', '⛈︎'],
  99: ['thunderstorm', '⛈︎'],
};

function renderWeather() {
  if (!weatherState) return;
  const temp = useCelsius ? Math.round(weatherState.tempC) : Math.round(weatherState.tempF);
  weatherTempEl.textContent = `${temp}°${useCelsius ? 'C' : 'F'}`;
  weatherIconEl.textContent = weatherState.icon;
  updateGreetingSub();
}

function updateGreetingSub() {
  if (weatherState) {
    greetingSubEl.textContent = `${weatherState.text}, ${Math.round(useCelsius ? weatherState.tempC : weatherState.tempF)}°${useCelsius ? 'C' : 'F'} outside — a set built for weather like this.`;
  } else {
    greetingSubEl.textContent = 'Soft static, wet streets, and a playlist that doesn’t ask questions.';
  }
}

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`);
    const data = await res.json();
    const code = data.current.weather_code;
    const [text, icon] = WEATHER_CODES[code] || ['unsettled', '☁︎'];
    const tempF = data.current.temperature_2m;
    weatherState = { tempF, tempC: (tempF - 32) * 5 / 9, text, icon };
    renderWeather();
    if (data.timezone) {
      clockTimeZone = data.timezone;
      updateClock();
    }
  } catch (e) {
    weatherLocationEl.textContent = 'unavailable';
  }
}

async function fetchLocationName(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const data = await res.json();
    weatherLocationEl.textContent = data.city || data.locality || data.principalSubdivision || 'nearby';
  } catch (e) {
    weatherLocationEl.textContent = '';
  }
}

function initWeather() {
  if (!navigator.geolocation) {
    fetchWeather(28.6139, 77.209);
    weatherLocationEl.textContent = 'New Delhi (default)';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      fetchWeather(latitude, longitude);
      fetchLocationName(latitude, longitude);
    },
    () => {
      // fallback: New Delhi, India
      fetchWeather(28.6139, 77.209);
      weatherLocationEl.textContent = 'New Delhi (default)';
    },
    { timeout: 8000 }
  );
}

initWeather();

document.getElementById('weatherPill').addEventListener('click', () => {
  useCelsius = !useCelsius;
  renderWeather();
});

/* ---------------- tracks ---------------- */
/* rotating chill r&b / mellow indie radio — thumbnails pulled live from YouTube, no key required */

const TRACKS = [
  { videoId: 'O1OTWCd40bc', artist: 'The Weeknd', title: 'Wicked Games', desc: 'hazy falsetto, midnight streets, that slow-burn ache.' },
  { videoId: 'yzTuBuRdAyA', artist: 'The Weeknd', title: 'The Hills', desc: 'headlights cutting through fog on a road that goes nowhere good.' },
  { videoId: 'JPIhUaONiLU', artist: 'The Weeknd', title: 'Often', desc: 'a low red glow and a bassline that won\'t let you sleep.' },
  { videoId: 'waU75jdUnYw', artist: 'The Weeknd', title: 'Earned It', desc: 'velvet curtains drawn tight against the storm outside.' },
  { videoId: 'KEI4qSrkPAs', artist: 'The Weeknd', title: 'Can\'t Feel My Face', desc: 'a euphoric blur where the rain feels like static on skin.' },
  { videoId: '34Na4j8AVgA', artist: 'The Weeknd', title: 'Starboy', desc: 'chrome reflections and a city that never quite goes quiet.' },
  { videoId: 'qFLhGq0060w', artist: 'The Weeknd', title: 'I Feel It Coming', desc: 'warm synths drifting in like the first break in the clouds.' },
  { videoId: 'M4ZoCHID9GI', artist: 'The Weeknd', title: 'Call Out My Name', desc: 'an empty apartment, a phone that stays dark, a name said too late.' },
  { videoId: '4NRXx6U8ABQ', artist: 'The Weeknd', title: 'Blinding Lights', desc: 'neon smeared across a wet windshield doing eighty toward nothing.' },
  { videoId: 'XXYlFuWEuKI', artist: 'The Weeknd', title: 'Save Your Tears', desc: 'mascara running with the downpour outside a party you left early.' },
  { videoId: 'dqRZDebPIGs', artist: 'The Weeknd', title: 'In Your Eyes', desc: 'a saxophone solo drifting over a city that refuses to sleep.' },
  { videoId: 'gSo0YiGPgHk', artist: 'The Weeknd', title: 'Die For You', desc: 'a confession whispered somewhere between heartbreak and hope.' },
  { videoId: 'diW6jXhLE0E', artist: 'The Weeknd', title: 'Party Monster', desc: 'strobe lights flickering against a comedown nobody talks about.' },
  { videoId: '1DpH-icPpl0', artist: 'The Weeknd', title: 'Heartless', desc: 'a numbness dressed up as a good time on a bad night.' },
  { videoId: 'DQbCHBhyxhM', artist: 'The Weeknd', title: 'High For This', desc: 'a slow countdown before the night tips over into something else.' },
  { videoId: 'mC9v5FaLt84', artist: 'Chase Atlantic', title: 'Swim', desc: 'sinking slow under a surface lit by somebody else\'s headlights.' },
  { videoId: 'vmM7h2fKdAY', artist: 'Chase Atlantic', title: 'Church', desc: 'confessing sins to no one in a room lit only by a phone screen.' },
  { videoId: 'j-_vl5AXsj0', artist: 'Chase Atlantic', title: 'Numb to the Feeling', desc: 'static where an emotion used to be, and the rain doesn\'t help.' },
  { videoId: 'E47KhT81CL8', artist: 'Chase Atlantic', title: 'Ricochet', desc: 'bad decisions bouncing off every wall of a too-quiet house.' },
  { videoId: 'WM28EGDUSj0', artist: 'Chase Atlantic', title: 'Facedown', desc: 'a pulse that won\'t slow down even after the lights cut out.' },
  { videoId: 'tOVIeLZtxDc', artist: 'Chase Atlantic', title: 'Slide', desc: 'sliding into something reckless because the night demands it.' },
  { videoId: 'wNliit0-u7c', artist: 'Chase Atlantic', title: 'Her', desc: 'the ghost of somebody\'s perfume still hanging in the air.' },
  { videoId: '0yFy32q_jR0', artist: 'Chase Atlantic', title: 'Disconnected', desc: 'a signal cutting out right when the truth starts to show.' },
  { videoId: 'wzvB90f1zhM', artist: 'Chase Atlantic', title: 'Chxse', desc: 'a mirror fogged over from a shower that ran too long.' },
  { videoId: 'lZp96uELegI', artist: 'Chase Atlantic', title: 'Into It', desc: 'a bassline that pulls you closer than you meant to go.' },
  { videoId: 'IIVm_2Ep1dk', artist: 'Chase Atlantic', title: 'Okay', desc: 'pretending everything\'s fine while the storm rattles the windows.' },
  { videoId: 'OZDYhdJCRlc', artist: 'Chase Atlantic', title: 'Run Away', desc: 'packing nothing but a bad mood and somewhere else to be.' },
  { videoId: 'ZFiWQodimPA', artist: 'Chase Atlantic', title: 'Heaven and Back', desc: 'a promise made too fast, half meant, fully believed.' },
  { videoId: 'T50lRtR2ZWE', artist: 'Chase Atlantic', title: 'Angels', desc: 'a halo of streetlight over something that isn\'t innocent at all.' },
  { videoId: 'JcOCAmj3fDs', artist: 'Chase Atlantic', title: 'Triggered', desc: 'a nerve struck raw under all that low, simmering bass.' },
  { videoId: 'GCdwKhTtNNw', artist: 'The Neighbourhood', title: 'Sweater Weather', desc: 'borrowed sleeves and cold hands tangled up in a backseat conversation.' },
  { videoId: '_lMlsPQJs6U', artist: 'The Neighbourhood', title: 'Daddy Issues', desc: 'a wound dressed up as a love song and worn like armor.' },
  { videoId: 'LILL0AV0938', artist: 'The Neighbourhood', title: 'Afraid', desc: 'standing bare under a spotlight that only shows the cracks.' },
  { videoId: 'BExvUjzeXPw', artist: 'The Neighbourhood', title: 'Wires', desc: 'a heart short-circuiting somewhere between wanting and leaving.' },
  { videoId: 'LVqGRJLEj28', artist: 'The Neighbourhood', title: 'A Little Death', desc: 'a slow fade to black set to a hush of falsetto.' },
  { videoId: '9BOv7VEEaUw', artist: 'The Neighbourhood', title: 'Cry Baby', desc: 'tears on a windowpane blurring the streetlights into halos.' },
  { videoId: 'ggG9ySCChYw', artist: 'The Neighbourhood', title: 'Softcore', desc: 'a tenderness nobody asked for, offered up anyway at 2am.' },
  { videoId: 'zTIoErJmsp4', artist: 'The Neighbourhood', title: 'Scary Love', desc: 'a heartbeat that sounds like a warning nobody wants to heed.' },
  { videoId: 'jCSvOtUaI8s', artist: 'The Neighbourhood', title: 'You Get Me So High', desc: 'a high that feels like falling with no ground in sight.' },
  { videoId: 'vKH-rcO6PA8', artist: 'The Neighbourhood', title: 'R.I.P. 2 My Youth', desc: 'a eulogy for who you were, sung under flickering streetlamps.' },
  { videoId: '8giBPUpzKRw', artist: 'The Neighbourhood', title: 'Stargazing', desc: 'lying flat on wet pavement, waiting for the sky to say something.' },
  { videoId: 'agdObcVqqMU', artist: 'The Neighbourhood', title: 'Void', desc: 'an emptiness that hums louder than any song could.' },
  { videoId: 'jwK7-u_0VWk', artist: 'The Neighbourhood', title: 'Female Robbery', desc: 'something stolen quietly, without anyone noticing it was gone.' },
  { videoId: 'j56dEcq7ryo', artist: 'The Neighbourhood', title: 'Compass', desc: 'no direction home, just a low hum guiding you nowhere in particular.' },
  { videoId: 'L0OORjXAtxg', artist: 'The Neighbourhood', title: 'How', desc: 'a question left hanging in the air long after the door shuts.' },
  { videoId: 'pK7egZaT3hs', artist: 'Arctic Monkeys', title: 'I Bet You Look Good on the Dancefloor', desc: 'sweat and static under cheap club lights that never quite go dark.' },
  { videoId: 'EqkBRVukQmE', artist: 'Arctic Monkeys', title: 'When the Sun Goes Down', desc: 'streetlamps flicker on over a town that keeps its secrets close.' },
  { videoId: 'ma9I9VBKPiw', artist: 'Arctic Monkeys', title: 'Fluorescent Adolescent', desc: 'faded photographs of a summer that got away too fast.' },
  { videoId: 'bpOSxM0rNPM', artist: 'Arctic Monkeys', title: 'Do I Wanna Know?', desc: 'a slow, dragging riff built for staring at a phone that won\'t light up.' },
  { videoId: '6366dxFf-Os', artist: 'Arctic Monkeys', title: 'Why\'d You Only Call Me When You\'re High?', desc: 'a late-night ring that only ever means one thing.' },
  { videoId: 'VQH8ZTgna3Q', artist: 'Arctic Monkeys', title: 'R U Mine?', desc: 'a question thrown out into the dark, half swagger, half nerve.' },
  { videoId: 'Nj8r3qmOoZ8', artist: 'Arctic Monkeys', title: 'Arabella', desc: 'a heavy, hazy riff built for headlights and a girl who\'s trouble.' },
  { videoId: 'iIfl5k2nQBQ', artist: 'Arctic Monkeys', title: '505', desc: 'a hotel corridor and a heartbeat that keeps counting the miles.' },
  { videoId: 'LIQz6zZi7R0', artist: 'Arctic Monkeys', title: 'Cornerstone', desc: 'chasing a familiar face through every stranger in a crowded room.' },
  { videoId: 'H8tLS_NOWLs', artist: 'Arctic Monkeys', title: 'Snap Out of It', desc: 'a plea muttered to someone who\'s already halfway out the door.' },
  { videoId: '71Es-8FfATo', artist: 'Arctic Monkeys', title: 'Four Out of Five', desc: 'a lounge-lizard groove drifting over a moon that\'s seen it all.' },
  { videoId: '6zgEObNc_-k', artist: 'Arctic Monkeys', title: 'Body Paint', desc: 'a slow unraveling set to strings that ache more than they soothe.' },
  { videoId: 'fLsBJPlGIDU', artist: 'Arctic Monkeys', title: 'Crying Lightning', desc: 'a storm rolling in over something that already feels broken.' },
  { videoId: 'mGUjVbsYG6E', artist: 'Arctic Monkeys', title: 'No. 1 Party Anthem', desc: 'a slow-dance ballad for a party that\'s already winding down.' },
  { videoId: 'SwYCb6gI1yM', artist: 'Arctic Monkeys', title: 'Knee Socks', desc: 'a whispered rendezvous timed to somebody else\'s clock.' },
  { videoId: 'CDXj-ovszxY', artist: 'Tame Impala', title: 'The Less I Know the Better', desc: 'a bassline throbbing under jealousy dressed up as a dance floor.' },
  { videoId: 'wycjnCCgUes', artist: 'Tame Impala', title: 'Feels Like We Only Go Backwards', desc: 'a slow spiral through a memory that keeps repeating itself.' },
  { videoId: 'LnKUD_OztRE', artist: 'Tame Impala', title: 'Elephant', desc: 'a heavy, lumbering riff stomping through a smoke-filled room.' },
  { videoId: 'pFptt7Cargc', artist: 'Tame Impala', title: 'Let It Happen', desc: 'a glitch in the night that loops until it finally lets go.' },
  { videoId: 'GHe8kKO8uds', artist: 'Tame Impala', title: 'Eventually', desc: 'a goodbye dressed in warm synths so it hurts a little less.' },
  { videoId: '_9bw_VtMUGA', artist: 'Tame Impala', title: 'New Person, Same Old Mistakes', desc: 'trying on a new life that fits exactly like the last one did.' },
  { videoId: '2g5xkLqIElU', artist: 'Tame Impala', title: 'Borderline', desc: 'standing at the edge of something, unsure which way to fall.' },
  { videoId: 'utCjuKDXQsE', artist: 'Tame Impala', title: 'Lost in Yesterday', desc: 'a memory replayed until the colors start to bleed together.' },
  { videoId: 'D_cMCvudZBs', artist: 'Tame Impala', title: 'Yes I\'m Changing', desc: 'watching the old version of yourself fade out the rearview mirror.' },
  { videoId: 'rUmV-MorIKc', artist: 'Tame Impala', title: 'Patience', desc: 'time moving in slow, syrupy circles while nothing quite resolves.' },
  { videoId: '-F2e9fmYL7Y', artist: 'Tame Impala', title: 'Solitude Is Bliss', desc: 'a locked door and a quiet that finally feels like relief.' },
  { videoId: 'KQH2Kq1QXaI', artist: 'Tame Impala', title: 'Apocalypse Dreams', desc: 'the world ending softly, somewhere in the back of a daydream.' },
  { videoId: 'qLGwIHjhboA', artist: 'Tame Impala', title: 'Is It True', desc: 'a question circling back on itself under a haze of reverb.' },
  { videoId: 'UTwlmgV3pEI', artist: 'Tame Impala', title: 'Breathe Deeper', desc: 'a long exhale stretched out until the room stops spinning.' },
  { videoId: 'bMLq3QQK6a8', artist: 'Tame Impala', title: 'One More Year', desc: 'watching the clock loop back on itself, same room, same static.' },
  {
    videoId: 'd7cVLE4SaN0',
    artist: 'Bryson Tiller',
    title: "Don't",
    desc: 'Trap-soul slow burn, low light and lower guard.',
  },
  {
    videoId: 'uWRlisQu4fo',
    artist: 'Giveon',
    title: 'Heartbreak Anniversary',
    desc: 'Baritone ache over a stripped-back, rainy-day groove.',
  },
  {
    videoId: 'uQFVqltOXRg',
    artist: 'Daniel Caesar',
    title: 'Get You (feat. Kali Uchis)',
    desc: 'Warm, gospel-tinged r&b built for slow mornings.',
  },
  {
    videoId: 'fS9m0Ac8PCU',
    artist: '6LACK',
    title: 'PRBLMS',
    desc: 'Murky, minimal r&b — moody as the weather.',
  },
  {
    videoId: 'v-zTyTdnvqM',
    artist: 'Frank Ocean',
    title: 'Ivy',
    desc: 'Nostalgic, guitar-laced, half-remembered summer.',
  },
  {
    videoId: '4976Fgvf5Ps',
    artist: 'Snoh Aalegra',
    title: 'I Want You Around',
    desc: 'Lush retro-soul with a cinematic, rain-soaked pull.',
  },
  {
    videoId: 'gWPHeH0vEp4',
    artist: 'dvsn',
    title: 'Mood',
    desc: 'Slow, dim-lit r&b built for 2am windows.',
  },
];

let currentIndex = Math.floor(Math.random() * TRACKS.length);
let ytPlayer = null;
let playerReady = false;
let isMuted = true;
let isPlaying = false;

const trackArtEl = document.getElementById('trackArt');
const trackArtistEl = document.getElementById('trackArtist');
const trackTitleEl = document.getElementById('trackTitle');
const trackDescEl = document.getElementById('trackDesc');
const ytLinkEl = document.getElementById('ytLink');
const playBtn = document.getElementById('playBtn');
const soundToggle = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
const soundLabel = document.getElementById('soundLabel');
const stereoCaptionEl = document.getElementById('stereoCaption');
const upnextListEl = document.getElementById('upnextList');
const upnextHeadingEl = document.getElementById('upnextHeading');
const progressFillEl = document.getElementById('progressFill');
const volumeKnobEl = document.getElementById('volumeKnob');

const UPNEXT_COUNT = 5;

function renderTrack() {
  const t = TRACKS[currentIndex];
  trackArtistEl.textContent = t.artist;
  trackTitleEl.textContent = t.title;
  trackDescEl.textContent = t.desc;
  ytLinkEl.href = `https://www.youtube.com/watch?v=${t.videoId}`;
  stereoCaptionEl.textContent = `${t.artist} – ${t.title}`.toUpperCase();
  document.title = `${t.artist} – ${t.title} · the aux`;
  upnextHeadingEl.textContent = `Up next · track ${currentIndex + 1}/${TRACKS.length}`;
  progressFillEl.style.width = '0%';

  const artUrl = `https://img.youtube.com/vi/${t.videoId}/maxresdefault.jpg`;
  trackArtEl.alt = `${t.title} — ${t.artist} album art`;
  trackArtEl.onerror = () => {
    trackArtEl.onerror = null;
    trackArtEl.src = `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`;
  };
  // crossfade: fade out, swap once the new image is actually loaded, fade back in
  trackArtEl.style.opacity = '0';
  const preload = new Image();
  preload.onload = () => {
    if (trackArtEl.alt !== `${t.title} — ${t.artist} album art`) return; // track changed again meanwhile
    trackArtEl.src = artUrl;
    setTimeout(() => { trackArtEl.style.opacity = '1'; }, 20);
  };
  preload.onerror = () => { trackArtEl.onerror(); trackArtEl.style.opacity = '1'; };
  preload.src = artUrl;

  updateMediaSession(t);
  renderUpNext();
}

function updateMediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: 'the aux — rainy night radio',
    artwork: [
      { src: `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
      { src: `https://img.youtube.com/vi/${t.videoId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
    ],
  });
}

function renderUpNext() {
  upnextListEl.innerHTML = '';
  for (let i = 1; i <= UPNEXT_COUNT; i++) {
    const index = (currentIndex + i) % TRACKS.length;
    const t = TRACKS[index];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'upnext-item';
    btn.type = 'button';
    btn.innerHTML = `
      <span class="upnext-index">${i}</span>
      <span class="upnext-meta">
        <span class="upnext-artist"></span>
        <span class="upnext-title"></span>
      </span>
    `;
    btn.querySelector('.upnext-artist').textContent = t.artist;
    btn.querySelector('.upnext-title').textContent = t.title;
    btn.addEventListener('click', () => loadTrack(index, true));
    li.appendChild(btn);
    upnextListEl.appendChild(li);
  }
}

function loadTrack(index, autoplay) {
  currentIndex = (index + TRACKS.length) % TRACKS.length;
  renderTrack();
  if (playerReady && ytPlayer) {
    if (autoplay) {
      ytPlayer.loadVideoById(TRACKS[currentIndex].videoId);
    } else {
      ytPlayer.cueVideoById(TRACKS[currentIndex].videoId);
    }
  }
}

/* YouTube IFrame API */

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('ytPlayer', {
    height: '1',
    width: '1',
    videoId: TRACKS[currentIndex].videoId,
    playerVars: {
      autoplay: 1,
      mute: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
    },
    events: {
      onReady: (e) => {
        playerReady = true;
        e.target.mute();
        e.target.playVideo();
      },
      onStateChange: (e) => {
        isPlaying = e.data === YT.PlayerState.PLAYING;
        playBtn.textContent = isPlaying ? '⏸' : '▶';
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
        if (e.data === YT.PlayerState.ENDED) {
          loadTrack(currentIndex + 1, true);
        }
      },
      onError: (e) => {
        // 2 = bad id, 5 = html5 error, 100 = removed/private, 101/150 = embedding disabled by owner
        const t = TRACKS[currentIndex];
        console.warn(`Playback error ${e.data} on "${t.title}" by ${t.artist} (${t.videoId}) — skipping.`);
        loadTrack(currentIndex + 1, true);
      },
    },
  });
};

playBtn.addEventListener('click', () => {
  if (!playerReady) return;
  if (isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
});

document.getElementById('prevBtn').addEventListener('click', () => loadTrack(currentIndex - 1, true));
document.getElementById('nextBtn').addEventListener('click', () => loadTrack(currentIndex + 1, true));

soundToggle.addEventListener('click', () => {
  if (!playerReady) return;
  isMuted = !isMuted;
  if (isMuted) {
    ytPlayer.mute();
    soundIcon.textContent = '\u{1F507}';
    soundLabel.textContent = 'tap for sound';
    soundToggle.classList.remove('on');
  } else {
    ytPlayer.unMute();
    ytPlayer.setVolume(volumeLevel);
    soundIcon.textContent = '\u{1F50A}';
    soundLabel.textContent = 'sound on';
    soundToggle.classList.add('on');
  }
});

/* ---------------- volume knob ---------------- */

const VOLUME_STEPS = [25, 50, 75, 100];
let volumeLevel = 50;

function applyVolumeKnobRotation() {
  const angle = -135 + (volumeLevel / 100) * 270;
  volumeKnobEl.style.transform = `rotate(${angle}deg)`;
  volumeKnobEl.title = `Volume ${volumeLevel}%`;
}

volumeKnobEl.addEventListener('click', () => {
  const stepIndex = VOLUME_STEPS.indexOf(volumeLevel);
  volumeLevel = VOLUME_STEPS[(stepIndex + 1) % VOLUME_STEPS.length];
  applyVolumeKnobRotation();
  if (!playerReady) return;
  ytPlayer.setVolume(volumeLevel);
  if (isMuted) {
    isMuted = false;
    ytPlayer.unMute();
    soundIcon.textContent = '\u{1F50A}';
    soundLabel.textContent = 'sound on';
    soundToggle.classList.add('on');
  }
});

applyVolumeKnobRotation();

/* ---------------- playback progress ---------------- */

setInterval(() => {
  if (!isPlaying || !ytPlayer || !ytPlayer.getDuration) return;
  const duration = ytPlayer.getDuration();
  if (!duration) return;
  const pct = (ytPlayer.getCurrentTime() / duration) * 100;
  progressFillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}, 1000);

/* ---------------- media session controls ---------------- */

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => playerReady && ytPlayer.playVideo());
  navigator.mediaSession.setActionHandler('pause', () => playerReady && ytPlayer.pauseVideo());
  navigator.mediaSession.setActionHandler('previoustrack', () => loadTrack(currentIndex - 1, true));
  navigator.mediaSession.setActionHandler('nexttrack', () => loadTrack(currentIndex + 1, true));
}

/* ---------------- keyboard shortcuts ---------------- */

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('button, a, input, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    playBtn.click();
  } else if (e.code === 'ArrowRight') {
    loadTrack(currentIndex + 1, true);
  } else if (e.code === 'ArrowLeft') {
    loadTrack(currentIndex - 1, true);
  }
});

renderTrack();
