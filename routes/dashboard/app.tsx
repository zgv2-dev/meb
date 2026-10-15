import { define } from "../../utils.ts";

// Mini App entry (the /dashboard button opens this URL inside Telegram). initData only exists in the
// browser, so a tiny script trades it for a session cookie, then loads the library.
const exchange = `
const app = window.Telegram?.WebApp;
app?.ready();
app?.expand();
const status = document.getElementById("status");
if (!app?.initData) {
  status.textContent = "Open the library from the bot: send /dashboard and tap the button.";
} else {
  fetch("/dashboard/login", { method: "POST", body: app.initData }).then(async (res) => {
    if (res.ok) location.replace("/dashboard");
    else status.textContent = await res.text();
  }, () => status.textContent = "Network error. Close and reopen the library.");
}
`;

export default define.page(() => (
  <main>
    <p id="status" class="empty">Opening your library…</p>
    <script dangerouslySetInnerHTML={{ __html: exchange }} />
  </main>
));
