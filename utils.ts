import { createDefine } from "fresh";
import type { Api } from "grammy";

// This specifies the type of "ctx.state" which is used to share
// data among middlewares, layouts and routes.
export interface State {
  // Bot API for dashboard routes, set in main.ts
  api: Api;
  // Logged-in Telegram user, set by routes/dashboard/_middleware.ts
  userId: number;
}

export const define = createDefine<State>();
