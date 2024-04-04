import { DiscordBotAdapter } from "./driving/discord-bot/discord-bot.adapter";
import {KoaAdapter} from "./driving/koa/koa.adapter";

export class Application {
  private discordBotAdapter?: DiscordBotAdapter;
  private koaAdapter?: KoaAdapter;

  async start() {
    this.discordBotAdapter = new DiscordBotAdapter();
    this.koaAdapter = new KoaAdapter(this.discordBotAdapter);

    await this.discordBotAdapter.start();
    await this.koaAdapter.start();
  }

  async stop() {
    await this.discordBotAdapter?.stop();
    await this.koaAdapter?.stop();
  }
}
