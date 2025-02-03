import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction, REST,
  Routes, SharedSlashCommand,
  SlashCommandBuilder
} from 'discord.js';
import config from 'config';
import cron from 'node-cron';
import {BonbonCommand} from "./commands/bonbon.command";
import logger from "../../logger";
import {RollCommand} from "./commands/roll.command";
import {DateCommand} from "./commands/date.command";
import {gregorianToMouvelian, MOUVELIAN_SEASONS} from "../../utils/date.utils";
import {AiCommand} from "./commands/ai.command";

export interface Command {
  name: string;
  execute(interaction: Interaction): Promise<void>;
  build(): SharedSlashCommand;
}

export class DiscordBotAdapter {
  private restClient = new REST().setToken(config.get('services.discord.token'));
  private client: Client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
  private commands = [
    new BonbonCommand(),
    new RollCommand(),
    new DateCommand(),
    new AiCommand(),
  ];
  private updateDateChannelCron?: cron.ScheduledTask;

  async start() {
    const commandsMap = new Collection<string, Command>();
    this.commands.forEach(command => {
      commandsMap.set(command.name, command);
    });

    this.client.once(Events.ClientReady, readyClient => {
      logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
    });

    this.client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      logger.debug(interaction);

      const command = commandsMap.get(interaction.commandName);

      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({ content: 'This command does not exist!', flags: ["Ephemeral"] });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error: any) {
        logger.error('Failed to execute command', { error: {
          message: error.message,
            name: error.name,
            stack: error.stack,
          } });
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: ["Ephemeral"] });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: ["Ephemeral"] });
        }
      }
    });

    await this.client.login(config.get('services.discord.token'));

    this.updateDateChannelCron = cron.schedule("0 * * * *", async () => {
      try {
        const date = gregorianToMouvelian(new Date());
        const dateChannelName = `${date.day} ${
          MOUVELIAN_SEASONS[date.season]
        } ${date.year}`;

        logger.info("Update date channel name.");
        if (!(this.client.uptime && this.client.uptime > 10000)) {
          logger.info("Bot is offline.");
          return;
        }

        const guild = await this.client.guilds.fetch(config.get('services.discord.guildId'));
        if (!guild) {
          logger.warn('Guild not found (check services.discord.guildId config).')
          return;
        }
        const channel = await guild.channels.fetch(config.get('services.discord.dateChannelId'));
        if (!channel) {
          logger.warn('Channel for date not found (check services.discord.dateChannelId config).')
          return;
        }
        await channel
          .setName(dateChannelName)
          .then((newChannel) =>
            logger.info(`Channel's new name is ${newChannel.name}`)
          );
      } catch (error) {
        logger.info("Could not update channel name.");
        logger.error(error);
      }
    });
  }

  async stop() {
    await this.client.destroy();
    this.updateDateChannelCron?.stop();
  }

  async refreshGuildCommands(guildId: string, empty = false) {
    if (empty) {
      await this.restClient.put(
        Routes.applicationGuildCommands(config.get('services.discord.clientId'), guildId),
        { body: [] },
      );
    } else {
      await this.restClient.put(
        Routes.applicationGuildCommands(config.get('services.discord.clientId'), guildId),
        { body: this.commands.map(command => command.build()) },
      );
    }
  }

  async refreshGlobalCommands() {
    await this.restClient.put(
      Routes.applicationCommands(config.get('services.discord.clientId')),
      { body: this.commands.map(command => command.build()) },
    );
  }
}
