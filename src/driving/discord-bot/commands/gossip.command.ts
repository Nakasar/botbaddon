import { Command } from '../discord-bot.adapter';
import {
  ContextMenuCommandBuilder,
  SharedSlashCommand,
  SlashCommandBuilder,
  ApplicationCommandType,
  Interaction,
  EmbedBuilder,
  time,
  TimestampStyles,
  Client,
} from 'discord.js';
import { Db } from 'mongodb';
import cron from 'node-cron';
import logger from '../../../logger';

interface Gossip {
  author: string;
  text: string;
  createdAt: string;
  discordMessageId?: string;
  discordUserId?: string;
}

export interface GossipCommandGateway {
  mongoClient: Db;
  client: Client;
}

export class GossipCommand implements Command {
  readonly name = 'gossips';

  constructor(private readonly gateway: GossipCommandGateway) {
    cron.schedule('*/15 * * * *', async () => this.updateGossipBoards());
  }

  async execute(interaction: Interaction) {
    if (interaction.isContextMenuCommand() && interaction.isMessageContextMenuCommand()) {
      const messageContent = interaction.targetMessage.content;

      if (messageContent.length >= 1000) {
        await interaction.reply({
          flags: ['Ephemeral'],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Erreur')
              .setDescription('La rumeur est trop longue (1000 caractères max).'),
          ],
        });
        return;
      }

      if (
        !interaction.targetMessage.author.username ||
        interaction.targetMessage.author.bot ||
        (await this.gateway.mongoClient
          .collection('blocked-users')
          .findOne({ discordId: interaction.targetMessage.author.id }))
      ) {
        await interaction.reply({
          flags: ['Ephemeral'],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Erreur')
              .setDescription('Les rumeurs doivent être écrites par des humains !.'),
          ],
        });
        return;
      }

      const gossip: Gossip = {
        text: messageContent,
        author: interaction.targetMessage.author.username,
        createdAt: new Date().toISOString(),
        discordMessageId: interaction.targetMessage.id,
        discordUserId: interaction.user.id,
      };

      await this.gateway.mongoClient
        .collection<Gossip>('gossips')
        .updateOne(
          { discordMessageId: interaction.targetMessage.id },
          { $set: gossip },
          { upsert: true },
        );

      await interaction.reply({
        flags: ['Ephemeral'],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Rumeur ajoutée !')
            .setDescription(
              'La rumeur est désormais accessible via le Kalendar et avec la commande des rumeurs.',
            ),
        ],
      });
    } else if (interaction.isChatInputCommand()) {
      switch (interaction.options.getSubcommand()) {
        case 'add':
          const gossipContent = interaction.options.getString('gossip');

          if (!gossipContent) {
            await interaction.reply({
              flags: ['Ephemeral'],
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF8000')
                  .setTitle('Erreur')
                  .setDescription('La rumeur ne peut pas être vide.'),
              ],
            });
            return;
          }

          if (
            await this.gateway.mongoClient
              .collection('gossips')
              .findOne({ discordId: interaction.user.id })
          ) {
            await interaction.reply({
              flags: ['Ephemeral'],
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF8000')
                  .setTitle('Erreur')
                  .setDescription('Les rumeurs doivent être écrites par des humains !.'),
              ],
            });
            return;
          }

          const gossip = {
            text: gossipContent,
            author: interaction.user.username,
            createdAt: new Date().toISOString(),
            discordUserId: interaction.user.id,
          };

          await this.gateway.mongoClient.collection<Gossip>('gossips').insertOne(gossip);

          await interaction.reply({
            flags: ['Ephemeral'],
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Rumeur ajoutée !')
                .setDescription(
                  'La rumeur est désormais accessible via le Kalendar et avec la commande des rumeurs.',
                ),
            ],
          });
          break;
        case 'list':
          const gossips = await this.gateway.mongoClient
            .collection<Gossip>('gossips')
            .find()
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();

          if (gossips.length === 0) {
            await interaction.reply({
              flags: ['Ephemeral'],
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF8000')
                  .setTitle('Rumeurs')
                  .setDescription("Il n'y a pas de rumeurs pour le moment."),
              ],
            });
            return;
          }

          await interaction.reply({
            embeds: gossips.slice(-5).map((gossip) =>
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle(
                  `Par ${gossip.author} (${time(new Date(gossip.createdAt), TimestampStyles.RelativeTime)})`,
                )
                .setDescription(gossip.text),
            ),
          });
          break;
        case 'board':
          return this.createGossipBoard(interaction);
        case 'remove-boards':
          return this.removeGossipBoards(interaction);
        default:
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

    return;
  }

  async createGossipBoard(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.channel?.isSendable()) {
      await interaction.reply({
        flags: ['Ephemeral'],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Erreur')
            .setDescription('Je ne peux pas envoyer de message dans ce salon.'),
        ],
      });
      return;
    }

    const gossips = await this.gateway.mongoClient
      .collection<Gossip>('gossips')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const message = await interaction.channel.send({
      content: 'Voici les dernières rumeurs :',
      embeds:
        gossips.length > 0
          ? gossips.map((gossip) =>
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle(
                  `Par ${gossip.author} (${time(new Date(gossip.createdAt), TimestampStyles.RelativeTime)})`,
                )
                .setDescription(gossip.text),
            )
          : [],
    });

    await this.gateway.mongoClient.collection('gossips-boards').insertOne({
      discordMessageId: message.id,
      discordChannelId: message.channelId,
      discordGuildId: message.guildId,
    });

    await interaction.reply({
      flags: ['Ephemeral'],
      embeds: [
        new EmbedBuilder()
          .setColor('#FF8000')
          .setTitle('Tableau des rumeurs')
          .setDescription('Le tableau des rumeurs a été créé.'),
      ],
    });
  }

  async removeGossipBoards(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    await this.gateway.mongoClient
      .collection('gossips-boards')
      .deleteMany({ discordChannelId: interaction.channelId });

    await interaction.reply({
      flags: ['Ephemeral'],
      embeds: [
        new EmbedBuilder()
          .setColor('#FF8000')
          .setTitle('Tableaux retirés')
          .setDescription(
            'Tous les tableaux des rumeurs ont été retirés de ce canal (les messages ne seront plus mis à jours).',
          ),
      ],
    });
  }

  async updateGossipBoards() {
    logger.debug('update gossip boards');

    const boardMessages = await this.gateway.mongoClient
      .collection('gossips-boards')
      .find()
      .toArray();

    const gossips = await this.gateway.mongoClient
      .collection<Gossip>('gossips')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    await Promise.all(
      boardMessages.map(async (boardMessage) => {
        const channel = await this.gateway.client.channels.fetch(boardMessage.discordChannelId);

        if (!channel || !channel.isSendable()) {
          logger.debug('Channel not sendable!');
          return;
        }

        const message = await channel.messages.fetch(boardMessage.discordMessageId);

        if (!message || !message.editable) {
          logger.debug('Message not editable!');
          return;
        }

        await message.edit({
          content: `Voici les dernières rumeurs (mis à jour ${time(new Date(), TimestampStyles.RelativeTime)}) :`,
          embeds:
            gossips.length > 0
              ? gossips.map((gossip) =>
                  new EmbedBuilder()
                    .setColor('Random')
                    .setTitle(
                      `Par ${gossip.author} (${time(new Date(gossip.createdAt), TimestampStyles.RelativeTime)})`,
                    )
                    .setDescription(gossip.text),
                )
              : [],
        });

        logger.debug('Message edited!');
      }),
    );
  }

  build(): (ContextMenuCommandBuilder | SharedSlashCommand)[] {
    return [
      new SlashCommandBuilder()
        .setName(this.name)
        .setNameLocalizations({
          fr: 'rumeurs',
        })
        .setDescription('Get and create gossips.')
        .setDescriptionLocalizations({
          fr: 'Consulter et créer des rumeurs.',
        })
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setNameLocalization('fr', 'ajouter')
            .addStringOption((option) =>
              option
                .setName('gossip')
                .setNameLocalization('fr', 'rumeur')
                .setDescription('Gossip text')
                .setDescriptionLocalization('fr', 'Texte de la rumeur')
                .setRequired(true),
            )
            .setDescription('Add a gossip.')
            .setDescriptionLocalization('fr', 'Ajouter une rumeur.'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('list')
            .setNameLocalization('fr', 'liste')
            .setDescription('List gossips.')
            .setDescriptionLocalization('fr', 'Lister les dernières rumeurs.'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('board')
            .setNameLocalization('fr', 'tableau')
            .setDescription('Tableau des dernières rumeurs (mis à jour régulièrement).'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-boards')
            .setNameLocalization('fr', 'retirer-tableaux')
            .setDescription('Supprime tous les tableaux des primes dans ce canal.'),
        ),
      new ContextMenuCommandBuilder()
        .setName(this.name)
        .setNameLocalization('fr', 'Créer ou actualiser une rumeur')
        .setType(ApplicationCommandType.Message),
    ];
  }
}
