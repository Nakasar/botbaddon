import { DiscordBotAdapter } from './driving/discord-bot/discord-bot.adapter';
import { KoaAdapter } from './driving/koa/koa.adapter';
import { MongoClient } from 'mongodb';
import config from 'config';

export class Application {
  private discordBotAdapter?: DiscordBotAdapter;
  private koaAdapter?: KoaAdapter;

  async start() {
    const mongoClient = await MongoClient.connect(config.get('services.mongo.url')).then((client) =>
      client.db(),
    );

    this.discordBotAdapter = new DiscordBotAdapter({
      mongoClient,
    });
    this.koaAdapter = new KoaAdapter(this.discordBotAdapter);

    await this.discordBotAdapter.start();
    await this.koaAdapter.start();
  }

  async stop() {
    await this.discordBotAdapter?.stop();
    await this.koaAdapter?.stop();
  }
}
