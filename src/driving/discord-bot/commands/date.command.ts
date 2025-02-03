import {
  ChatInputCommandInteraction,
  ColorResolvable,
  EmbedBuilder,
  SharedSlashCommand,
  SlashCommandBuilder
} from "discord.js";
import {Command} from "../discord-bot.adapter";
import logger from "../../../logger";
import {
  dateToFrenchString, frenchToDate,
  frenchToMouvelian,
  gregorianToMouvelian,
  mouvelianToFrenchString, mouvelianToGregorian
} from "../../../utils/date.utils";

export class DateCommand implements Command {
  readonly name = 'date';

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.options.getSubcommand() === 'today') {
      const date = new Date();
      const mouvelianDate = gregorianToMouvelian(date);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Conversion de date")
            .setDescription(
              `**${mouvelianToFrenchString(mouvelianDate, { withYear: true })}** <- _(${dateToFrenchString(date, { withYear: true })})_`
            ),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'mouvelien') {
      try {
        const date = interaction.options.getString('date');
        if (!date) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle("Conversion de date")
                .setDescription(
                  'Date non précisée comme paramètre.'
                ),
            ],
          });
          return;
        }

        const realDate = frenchToDate(date);
        const mouvelianDate = gregorianToMouvelian(realDate);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Conversion de date")
              .setDescription(
                `**${mouvelianToFrenchString(mouvelianDate, { withYear: true })}** <- _(${dateToFrenchString(realDate, { withYear: true })})_`
              ),
          ],
        });
        return;
      } catch (error) {
        logger.error(error);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Conversion de date")
              .setDescription(
                "Je n'ai pas été capable de convertir cette date (une date Grégorien ressemble à *4 Mars*)."
              ),
          ],
        });
        return;
      }
    } else if (interaction.options.getSubcommand() === 'gregorien') {
      try {
        const date = interaction.options.getString('date');
        if (!date) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#FF8000')
                .setTitle("Conversion de date")
                .setDescription(
                  'Date non précisée comme paramètre.'
                ),
            ],
          });
          return;
        }

        const mouvelianDate = frenchToMouvelian(date);
        const realDate = mouvelianToGregorian(mouvelianDate);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Conversion de date")
              .setDescription(
                `**${dateToFrenchString(realDate, { withYear: true })}** <- _(${mouvelianToFrenchString(mouvelianDate, { withYear: true })})_`
              ),
          ],
        });
        return;
      } catch (err) {
        logger.error(err);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Conversion de date")
              .setDescription(
                "Je n'ai pas été capable de convertir cette date (une date Mouvelienne ressemble à *4 Zéphyr*)."
              ),
          ],
        });
        return;
      }
    } else {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Conversion de date")
            .setDescription(
              'Commande non valide.'
            ),
        ],
      });
    }
  }

  build(): SharedSlashCommand {
    return new SlashCommandBuilder()
      .setName(this.name)
      .addSubcommand(subcommand =>
        subcommand
          .setName('today')
          .setDescription("Affiche la date Mouvelienne actuelle")
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('mouvelien')
          .addStringOption(option =>
            option
              .setName('date')
              .setDescription('La date à convertir (ex: 10 mars, dd/mm/aaaa, ...)')
              .setRequired(true))
          .setDescription("Transforme la date réelle en date Mouvelienne")
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('gregorien')
          .addStringOption(option =>
            option
              .setName('date')
              .setDescription('La date à convertir (ex: 10 Zéphyr)')
              .setRequired(true))
          .setDescription("Transforme la date Mouvelienne en date réelle")
      )
      .setDescription("Convertir des dates depuis et vers le calendrier Mouvelien");
  }
}
