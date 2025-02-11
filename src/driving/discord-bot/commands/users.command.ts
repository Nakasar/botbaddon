import { Command } from '../discord-bot.adapter';
import { EmbedBuilder, Interaction, SlashCommandBuilder } from 'discord.js';
import { Db } from 'mongodb';
import config from 'config';

export interface UsersCommandGateway {
  mongoClient: Db;
}

export class UsersCommand implements Command {
  readonly name = 'users';

  constructor(private readonly gateway: UsersCommandGateway) {}

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!config.get<string[]>('services.discord.admins').includes(interaction.user.id)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Une voix par délà le voile...')
            .setDescription('Abaddon ne vous répond pas...'),
        ],
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'block') {
      const user = interaction.options.getUser('user');

      if (!user) {
        await interaction.reply({
          flags: ['Ephemeral'],
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Utilisateur introuvable')
              .setDescription("L'utilisateur que vous avez mentionné n'existe pas."),
          ],
        });
        return;
      }

      await this.gateway.mongoClient.collection('blocked-users').insertOne({
        discordId: user.id,
      });

      await interaction.reply({
        flags: ['Ephemeral'],
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('Utilisateur bloqué!')
            .setDescription("L'utilisateur a été bloqué et ne peut plus utiliser mes services."),
        ],
      });
    } else if (subcommand === 'unblock') {
      const user = interaction.options.getUser('user');

      if (!user) {
        await interaction.reply({
          flags: ['Ephemeral'],
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('Utilisateur introuvable')
              .setDescription("L'utilisateur que vous avez mentionné n'existe pas."),
          ],
        });
        return;
      }

      await this.gateway.mongoClient.collection('blocked-users').deleteOne({
        discordId: user.id,
      });

      await interaction.reply({
        flags: ['Ephemeral'],
        embeds: [
          new EmbedBuilder()
            .setColor('Green')
            .setTitle('Utilisateur débloqué!')
            .setDescription("L'utilisateur peut de nouveau utiliser mes services."),
        ],
      });
    } else {
      await interaction.reply({
        flags: ['Ephemeral'],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Bientôt disponible...')
            .setDescription("Cette commande n'est pas encore accessible."),
        ],
      });
    }
  }

  build() {
    return [
      new SlashCommandBuilder()
        .setName(this.name)
        .setNameLocalization('fr', 'utilisateurs')
        .setDescription('Manage users')
        .setDescriptionLocalization('fr', 'Gérer les utilisateurs')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('block')
            .setDescription('Block a user')
            .setDescriptionLocalization('fr', 'Bloquer un utilisateur')
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to block')
                .setDescriptionLocalization('fr', "L'utilisateur à bloquer")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('unblock')
            .setDescription('Unblock a user')
            .setDescriptionLocalization('fr', 'Débloquer un utilisateur')
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to unblock')
                .setDescriptionLocalization('fr', "L'utilisateur à débloquer")
                .setRequired(true),
            ),
        ),
    ];
  }
}
