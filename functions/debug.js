const deepLink = 'hayase://debug/'

export function onRequest () {
  const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta property="og:title" content="Debug Page">
    <meta property="og:description" content="Debug page for helping users with issues. Made for user support.">
    <meta property="og:site_name" content="Hayase">
    <meta property="og:url" content=hayase://debug>
    <meta name="theme-color" content="#17191C">
  </head>
  <body>
    <a href="${deepLink}">Redirecting...</a>
    <script>
      location.href = '${deepLink}'
      setTimeout(() => { location.replace('https://hayase.watch') }, 3000)
    </script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}
