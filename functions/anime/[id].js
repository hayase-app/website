// import cookie from 'cookie'

// this is a bit scuffed, but these are cf pages redirect functions
function endIndex (str, min, len) {
  const index = str.indexOf(';', min)
  return index === -1 ? len : index
}
/**
 * Find the `=` character between `min` and `max` in str.
 */
function eqIndex (str, min, max) {
  const index = str.indexOf('=', min)
  return index < max ? index : -1
}
/**
 * Slice out a value between startPod to max.
 */
function valueSlice (str, min, max) {
  let start = min
  let end = max
  do {
    const code = str.charCodeAt(start)
    if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) { break }
  } while (++start < end)
  while (end > start) {
    const code = str.charCodeAt(end - 1)
    if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) { break }
    end--
  }
  return str.slice(start, end)
}

function decode (str) {
  if (str.indexOf('%') === -1) { return str }
  try {
    return decodeURIComponent(str)
  } catch (e) {
    return str
  }
}

/**
 * RegExp to match max-age-value in RFC 6265 sec 5.6.2
 */
const maxAgeRegExp = /^-?\d+$/

function parseSetCookie (str, options) {
  const dec = options?.decode || decode
  const len = str.length
  const endIdx = endIndex(str, 0, len)
  const eqIdx = eqIndex(str, 0, endIdx)
  const setCookie = eqIdx === -1
    ? { name: '', value: dec(valueSlice(str, 0, endIdx)) }
    : {
        name: valueSlice(str, 0, eqIdx),
        value: dec(valueSlice(str, eqIdx + 1, endIdx))
      }
  let index = endIdx + 1
  while (index < len) {
    const endIdx = endIndex(str, index, len)
    const eqIdx = eqIndex(str, index, endIdx)
    const attr = eqIdx === -1
      ? valueSlice(str, index, endIdx)
      : valueSlice(str, index, eqIdx)
    const val = eqIdx === -1 ? undefined : valueSlice(str, eqIdx + 1, endIdx)
    switch (attr.toLowerCase()) {
      case 'httponly':
        setCookie.httpOnly = true
        break
      case 'secure':
        setCookie.secure = true
        break
      case 'partitioned':
        setCookie.partitioned = true
        break
      case 'domain':
        setCookie.domain = val
        break
      case 'path':
        setCookie.path = val
        break
      case 'max-age':
        if (val && maxAgeRegExp.test(val)) { setCookie.maxAge = Number(val) }
        break
      case 'expires':
        if (!val) { break }
        const date = new Date(val)
        if (Number.isFinite(date.valueOf())) { setCookie.expires = date }
        break
      case 'priority':
        if (!val) { break }
        const priority = val.toLowerCase()
        if (priority === 'low' ||
                    priority === 'medium' ||
                    priority === 'high') {
          setCookie.priority = priority
        }
        break
      case 'samesite':
        if (!val) { break }
        const sameSite = val.toLowerCase()
        if (sameSite === 'lax' ||
                    sameSite === 'strict' ||
                    sameSite === 'none') {
          setCookie.sameSite = sameSite
        }
        break
    }
    index = endIdx + 1
  }
  return setCookie
}

/**
 * @type {any} sess
 */
let sess
/**
 * @type {string | undefined}
 */
let token

async function getCookie () {
  if (sess && token && sess.expires >= new Date()) return { sess, token }

  const res = await fetch('https://anilist.co/')

  const cookieObj = parseSetCookie(res.headers.get('set-cookie') ?? '')

  const body = await res.text()

  token = /window\.al_token = "([^"]+)"/.exec(body)?.[1]

  if (!token || cookieObj.name !== 'laravel_session') throw new Error('Failed to retrieve token or session cookie')

  sess = cookieObj

  return { sess, token }
}

/**
 * A redirect to a non-http scheme is not reliable. Some browsers drop it. Serve
 * the OG tags and a page that opens the app.
 */
function openInApp (id) {
  const deepLink = 'hayase://anime/' + id

  const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta property="og:title" content="Shared Anime">
    <meta property="og:description" content='Stream anime torrents, real-time with no waiting for downloads.'>
    <meta property="og:site_name" content="Hayase">
    <meta property="og:image" content=https://img.anili.st/media/${id}>
    <meta property="og:url" content=hayase://anime/${id}>
    <meta data-vmid="twitter:card" name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content='#17191C'>
  </head>
  <body>
    <a href="${deepLink}">Redirecting...</a>
    <script>location.href = '${deepLink}'</script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}

export async function onRequest ({ params, request }) {
  const id = Number(params.id)
  if (!Number.isSafeInteger(id)) return Response.redirect('https://hayase.watch/')

  const ua = request.headers.get('user-agent') ?? ''

  // A crawler cannot open the app, so serve the preview page.
  if (!ua.includes('Discordbot')) return openInApp(id)

  try {
    const { sess, token } = await getCookie()

    const res = await fetch('https://anilist.co/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `${sess.name}=${sess.value}`,
        'x-csrf-token': token,
        Referer: 'https://anilist.co/anime/' + id
      },
      body: JSON.stringify({
        query: /* js */`
            query($id: Int) {
              Media(id: $id) {
                title {
                  english,
                  userPreferred
                }
                coverImage {
                  large
                  color
                },
                description,
                seasonYear
              }
            }
          `,
        variables: {
          id
        }
      }).replace('\n', ',')
    })
    if (!res.ok) {
      const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta http-equiv=refresh content="5; url=https://hayase.watch">
    <meta property="og:title" content="Shared Anime">
    <meta property="og:description" content='Stream anime torrents, real-time with no waiting for downloads.'>
    <meta property="og:site_name" content="Hayase">
    <meta property="og:image" content=https://img.anili.st/media/${id}>
    <meta property="og:url" content=hayase://anime/${id}>
    <meta data-vmid="twitter:card" name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content='#17191C'>
  </head>
  <body>
  </body>
</html>`
      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8'
        }
      })
    }

    const { data } = await res.json()

    const title = data.Media.title.english ?? data.Media.title.userPreferred ?? 'Anime'

    const strippedDescription = data.Media.description?.replace(/<[^>]+>/g, '') ?? ''

    const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta http-equiv=refresh content="5; url=https://hayase.watch">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${strippedDescription ?? 'Stream anime torrents, real-time with no waiting for downloads.'}">
    <meta property="og:site_name" content="Hayase">
    <meta property="og:image" content=https://img.anili.st/media/${id}>
    <meta property="og:url" content=hayase://anime/${id}>
    <meta data-vmid="twitter:card" name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="${data.Media.coverImage.color ?? '#17191C'}">
  </head>
  <body>
  </body>
</html>`

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8'
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Redirect error:', msg)
    const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta http-equiv=refresh content="5; url=https://hayase.watch">
    <meta property="og:title" content="Shared Anime">
    <meta property="og:description" content='Stream anime torrents, real-time with no waiting for downloads.'>
    <meta property="og:site_name" content="Hayase">
    <meta property="og:image" content=https://img.anili.st/media/${id}>
    <meta property="og:url" content=hayase://anime/${id}>
    <meta data-vmid="twitter:card" name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content='#17191C'>
  </head>
  <body>
  </body>
</html>`
    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8'
      }
    })
  }
  return Response.redirect('https://hayase.watch/')
}
