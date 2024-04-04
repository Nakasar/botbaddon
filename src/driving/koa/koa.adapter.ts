import config from 'config';
import Koa from 'koa';
import { Server } from 'node:http';

import logger from "../../logger";
import Router from "@koa/router";
import {DiscordBotAdapter} from "../discord-bot/discord-bot.adapter";

export class KoaAdapter {
  private app: Koa = new Koa();
  private server?: Server;

  constructor(private readonly discordBot: DiscordBotAdapter) {}

  async start() {
    const botManagerRouter = new Router();

    botManagerRouter.post('/refresh-guild-commands', (ctx) => {
      if (ctx.headers['x-api-key'] !== config.get('authentication.apiKey')) {
        ctx.status = 401;
        ctx.body = {
          error: {
            message: 'Unauthorized',
            code: 'unauthorized',
          }
        };
        return;
      }

      const guildId = ctx.request.query.guildId;

      if (typeof guildId !== 'string') {
        ctx.status = 400;
        ctx.body = {
          error: {
            message: 'guildId query parameter is required (right click your server in Discord in developer mode and click "Copy identifier").',
            code: 'invalid_guild_id',
          }
        };
        return;
      }

      this.discordBot.refreshGuildCommands(guildId);

      ctx.status = 204;
    });

    botManagerRouter.post('/refresh-global-commands', (ctx) => {
      if (ctx.headers['x-api-key'] !== config.get('authentication.apiKey')) {
        ctx.status = 401;
        ctx.body = {
          error: {
            message: 'Unauthorized',
            code: 'unauthorized',
          }
        };
        return;
      }

      this.discordBot.refreshGlobalCommands();

      ctx.status = 204;
    });

    this.app.use(botManagerRouter.routes());

    this.server = this.app.listen(config.get('server.port'), () => {
      logger.info(`REST app listening on port ${config.get('server.port')}`);
    });
  }

  async stop() {
    this.server?.close(() => {
      logger.info('REST app stopped');
    });
  }
}