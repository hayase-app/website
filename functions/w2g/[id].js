// this is a bit scuffed, but these are cf pages redirect functions

export function onRequest ({ params }) {
  try {
    const id = encodeURIComponent(params.id)
    const deepLink = 'hayase://w2g/' + id
    const html = /* html */`
<!DOCTYPE html>
<html style=background:#000>
  <head>
    <meta property="og:title" content="Watch Together">
    <meta property="og:description" content="Stream anime torrents, real-time with no waiting for downloads">
    <meta property="og:site_name" content="Hayase">
    <meta property="og:image" content=https://hayase.watch/app_original.png>
    <meta property="og:url" content=hayase://w2g/${id}>
    <meta data-vmid="twitter:card" name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#17191C">
  </head>
  <body>
    <a href="${deepLink}">Redirecting...</a>
    <script>location.href = ${JSON.stringify(deepLink)}</script>
  </body>
</html>`

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8'
      }
    })
  } catch (e) {
    return Response.redirect('https://hayase.watch/')
  }
}
