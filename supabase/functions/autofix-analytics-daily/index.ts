import { createDailyHandler } from './handler.js';
import { createDailyStore } from './store.ts';
import { dailyTelegram } from './telegram.js';
const env = (name: string) => Deno.env.get(name) ?? '';
const transport = dailyTelegram({ token: env('AUTOFIX_TELEGRAM_BOT_TOKEN'), chatId: env('AUTOFIX_TELEGRAM_CHAT_ID'), forumTargets: env('AUTOFIX_TELEGRAM_FORUM_TARGETS') });
const store = createDailyStore(env);
Deno.serve(createDailyHandler({store, transport, secret:'', authorize: store.authorize}));
