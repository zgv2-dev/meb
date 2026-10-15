import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Music Library</title>
        {/* Telegram Mini App API: theme colors, ready/expand, in-app links. A no-op in a normal browser. */}
        <script src="https://telegram.org/js/telegram-web-app.js?64"></script>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
