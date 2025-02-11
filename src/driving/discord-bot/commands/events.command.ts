import { Command } from '../discord-bot.adapter';
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  Interaction,
  MessageFlags,
  SlashCommandBuilder,
  time,
  ButtonStyle,
  Client,
  TimestampStyles,
  MessagePayload,
  MessageEditOptions,
} from 'discord.js';
import { Db } from 'mongodb';
import cron from 'node-cron';
import logger from '../../../logger';
import { Gossip } from './gossip.command';
import config from 'config';

export type RPEvent = {
  id: string;
  href: string;
  title: string;
  description: string;
  cover?: string;
  start: string;
  end: string;
  location: string;
  createdAt: string;
  creator: string;
};

export interface EventsCommandGateway {
  mongoClient: Db;
  client: Client;
}

export class EventsCommand implements Command {
  readonly name = 'events';

  constructor(private readonly gateway: EventsCommandGateway) {
    cron.schedule('*/15 * * * *', async () => this.updateEventBoards());
  }

  async execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      if (interaction.options.getSubcommand() === 'list') {
        const eventsResponse = await fetch(`${config.get('services.kalendar.endpoint')}/events`);

        if (!eventsResponse.ok) {
          await interaction.reply({
            content: "Oups! Une erreur s'est produite !",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const events: RPEvent[] = await eventsResponse.json();

        if (events.length === 0) {
          await interaction.reply({
            flags: [MessageFlags.Ephemeral],
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Aucun évènement à venir!')
                .setDescription(
                  "Il n'y a pas d'évènement à venir pour le moment, n'hésite pas à en créer sur [le Kalendar](https://gw2rp.eu) ou avec mes commandes.",
                ),
            ],
          });
          return;
        }

        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Prochains évènements')
              .setDescription(
                'Voici les prochains évènements prévus. Clique sur les boutons pour en savoir plus.',
              ),
            ...events.map((event) => {
              const embed = new EmbedBuilder()
                .setColor('Random')
                .setTitle(event.title)
                .setURL(event.href)
                .addFields(
                  { name: '📅 Début', value: time(new Date(event.start)), inline: true },
                  { name: '📅 Fin', value: time(new Date(event.end)), inline: true },
                );

              if (event.cover) {
                embed.setImage(event.cover);
              }

              if (event.description) {
                embed.setDescription(event.description.substring(0, 3500));
              }

              return embed;
            }),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              events.map((event) =>
                new ButtonBuilder()
                  .setLabel(event.title)
                  .setCustomId(`events-details-${event.id}`)
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
          ],
        });
      } else if (interaction.options.getSubcommand() === 'board') {
        return this.createEventBoard(interaction);
      } else if (interaction.options.getSubcommand() === 'remove-boards') {
        return this.removeEventBoards(interaction);
      } else {
        await interaction.reply({
          content: "La commande n'est pas encore active.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    } else if (interaction.isMessageContextMenuCommand()) {
      await interaction.reply({
        content: "La commande n'est pas encore active.",
        flags: [MessageFlags.Ephemeral],
      });
    } else if (interaction.isMessageComponent()) {
      if (interaction.customId.startsWith('events-details-')) {
        const eventId = interaction.customId.replace('events-details-', '');
        const eventResponse = await fetch(
          `${config.get('services.kalendar.endpoint')}/events/${eventId}`,
        );

        if (!eventResponse.ok) {
          await interaction.reply({
            content: "Oups! Une erreur s'est produite !",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const event: RPEvent = await eventResponse.json();

        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('Random')
              .setTitle(event.title)
              .setURL(event.href)
              .addFields(
                { name: '📅 Début', value: time(new Date(event.start)), inline: true },
                { name: '📅 Fin', value: time(new Date(event.end)), inline: true },
              )
              .setDescription(event.description?.substring(0, 3500))
              .setImage(event.cover ?? null),
          ],
        });
      } else {
        await interaction.reply({
          content: "La commande n'est pas encore active.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  }

  build() {
    return [
      new SlashCommandBuilder()
        .setName(this.name)
        .setNameLocalizations({
          fr: 'events',
        })
        .setDescription('Get and create events.')
        .setDescriptionLocalizations({
          fr: 'Consulter et créer des évènements.',
        })
        .addSubcommand((subcommand) =>
          subcommand
            .setName('list')
            .setNameLocalization('fr', 'liste')
            .setDescription('List events.')
            .setDescriptionLocalization('fr', 'Lister les évènements.'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('board')
            .setNameLocalization('fr', 'tableau')
            .setDescription('Tableau des derniers évènements (mis à jour régulièrement).'),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-boards')
            .setNameLocalization('fr', 'retirer-tableaux')
            .setDescription('Supprime tous les tableaux des évènements dans ce canal.'),
        ),
    ];
  }

  async createEventBoard(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.channel?.isSendable()) {
      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Erreur')
            .setDescription('Je ne peux pas envoyer de message dans ce salon.'),
        ],
      });
      return;
    }

    const eventsResponse = await fetch(`${config.get('services.kalendar.endpoint')}/events`);

    if (!eventsResponse.ok) {
      return;
    }

    const events: RPEvent[] = await eventsResponse.json();

    const newMessage: MessageEditOptions =
      events.length === 0
        ? {
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Aucun évènement à venir!')
                .setDescription(
                  "Il n'y a pas d'évènement à venir pour le moment, n'hésite pas à en créer sur [le Kalendar](https://gw2rp.eu) ou avec mes commandes.",
                ),
            ],
          }
        : {
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Prochains évènements')
                .setDescription(
                  'Voici les prochains évènements prévus. Clique sur les boutons pour en savoir plus.',
                ),
              ...events.map((event) => {
                const embed = new EmbedBuilder()
                  .setColor('Random')
                  .setTitle(event.title)
                  .setURL(event.href)
                  .addFields(
                    { name: '📅 Début', value: time(new Date(event.start)), inline: true },
                    { name: '📅 Fin', value: time(new Date(event.end)), inline: true },
                  );

                if (event.cover) {
                  embed.setImage(event.cover);
                }

                if (event.description) {
                  embed.setDescription(event.description.substring(0, 3500));
                }

                return embed;
              }),
            ],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                events.map((event) =>
                  new ButtonBuilder()
                    .setLabel(event.title)
                    .setCustomId(`events-details-${event.id}`)
                    .setStyle(ButtonStyle.Secondary),
                ),
              ),
            ],
          };

    const message = await interaction.channel.send({
      content: 'Voici les prochains évènements :',
      embeds:
        events.length > 0
          ? events.map((event) => {
              const embed = new EmbedBuilder()
                .setColor('Random')
                .setTitle(event.title)
                .setURL(event.href)
                .addFields(
                  { name: '📅 Début', value: time(new Date(event.start)), inline: true },
                  { name: '📅 Fin', value: time(new Date(event.end)), inline: true },
                );

              if (event.cover) {
                embed.setImage(event.cover);
              }

              if (event.description) {
                embed.setDescription(event.description.substring(0, 3500));
              }

              return embed;
            })
          : [],
      components:
        events.length > 0
          ? [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                events.map((event) =>
                  new ButtonBuilder()
                    .setLabel(event.title)
                    .setCustomId(`events-details-${event.id}`)
                    .setStyle(ButtonStyle.Secondary),
                ),
              ),
            ]
          : [],
    });

    await this.gateway.mongoClient.collection('events-boards').insertOne({
      discordMessageId: message.id,
      discordChannelId: message.channelId,
      discordGuildId: message.guildId,
    });

    await interaction.reply({
      flags: [MessageFlags.Ephemeral],
      embeds: [
        new EmbedBuilder()
          .setColor('#FF8000')
          .setTitle('Tableau des évènements')
          .setDescription('Le tableau des évènements a été créé.'),
      ],
    });
  }

  async removeEventBoards(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    await this.gateway.mongoClient
      .collection('events-boards')
      .deleteMany({ discordChannelId: interaction.channelId });

    await interaction.reply({
      flags: [MessageFlags.Ephemeral],
      embeds: [
        new EmbedBuilder()
          .setColor('#FF8000')
          .setTitle('Tableaux retirés')
          .setDescription(
            'Tous les tableaux des évènements ont été retirés de ce canal (les messages ne seront plus mis à jours).',
          ),
      ],
    });
  }

  async updateEventBoards() {
    logger.debug('update event boards');
    const boardMessages = await this.gateway.mongoClient
      .collection('events-boards')
      .find()
      .toArray();

    const eventsResponse = await fetch(`${config.get('services.kalendar.endpoint')}/events`);

    if (!eventsResponse.ok) {
      return;
    }

    const events: RPEvent[] = await eventsResponse.json();

    const newMessage: MessageEditOptions =
      events.length === 0
        ? {
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Aucun évènement à venir!')
                .setDescription(
                  "Il n'y a pas d'évènement à venir pour le moment, n'hésite pas à en créer sur [le Kalendar](https://gw2rp.eu) ou avec mes commandes.",
                ),
            ],
          }
        : {
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle('Prochains évènements')
                .setDescription(
                  `Voici les prochains évènements prévus (mis à jour ${time(new Date(), TimestampStyles.RelativeTime)}). Clique sur les boutons pour en savoir plus.`,
                ),
              ...events.map((event) => {
                const embed = new EmbedBuilder()
                  .setColor('Random')
                  .setTitle(event.title)
                  .setURL(event.href)
                  .addFields(
                    { name: '📅 Début', value: time(new Date(event.start)), inline: true },
                    { name: '📅 Fin', value: time(new Date(event.end)), inline: true },
                  );

                if (event.cover) {
                  embed.setImage(event.cover);
                }

                if (event.description) {
                  embed.setDescription(event.description.substring(0, 3500));
                }

                return embed;
              }),
            ],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                events.map((event) =>
                  new ButtonBuilder()
                    .setLabel(event.title)
                    .setCustomId(`events-details-${event.id}`)
                    .setStyle(ButtonStyle.Secondary),
                ),
              ),
            ],
          };

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

        await message.edit(newMessage);

        logger.debug('Message edited!');
      }),
    );
  }
}
