import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction, REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import config from 'config';
import {BonbonCommand} from "./commands/bonbon.command";
import logger from "../../logger";
import {RollCommand} from "./commands/roll.command";
import {DateCommand} from "./commands/date.command";

export interface Command {
  name: string;
  execute(interaction: Interaction): Promise<void>;
  build(): SlashCommandBuilder;
}

export class DiscordBotAdapter {
  private restClient = new REST().setToken(config.get('services.discord.token'));
  private client: Client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  private commands = [
    new BonbonCommand(),
    new RollCommand(),
    new DateCommand(),
  ];

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
        await interaction.reply({ content: 'This command does not exist!', ephemeral: true });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
    });

    await this.client.login(config.get('services.discord.token'));
  }

  async stop() {
    await this.client.destroy();
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
