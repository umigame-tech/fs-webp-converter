import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>404 Not Found</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; }
      main { text-align: center; padding: 2rem; }
      h1 { font-size: clamp(2.5rem, 5vw, 3.5rem); margin-bottom: 0.5rem; }
      p { margin: 0; color: #94a3b8; }
    </style>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>指定されたページは見つかりませんでした。</p>
    </main>
  </body>
</html>`;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  const statusFromRouter = routerContext.staticHandlerContext?.statusCode;
  if (statusFromRouter) {
    responseStatusCode = statusFromRouter;
  }

  if (responseStatusCode === 404) {
    responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    return new Response(NOT_FOUND_HTML, {
      headers: responseHeaders,
      status: 404,
    });
  }

  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
    }
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
