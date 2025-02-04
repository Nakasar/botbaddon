import {Command} from "../discord-bot.adapter";
import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SharedSlashCommand,
  SlashCommandBuilder
} from "discord.js";
import {
  AudioPlayerStatus, AudioResource,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel
} from "@discordjs/voice";
import config from "config";
import {ElevenLabsClient} from "elevenlabs";
import logger from "../../../logger";
import path from "node:path";
import {Readable} from "node:stream";

const elevenlabs = new ElevenLabsClient({
  apiKey: config.get('services.elevenlabs.apiKey'), // Defaults to process.env.ELEVENLABS_API_KEY
});

export class AiCommand implements Command {
  readonly name = 'ai';

  async execute(interaction: ChatInputCommandInteraction) {
    if (!config.get<string[]>('services.discord.admins').includes(interaction.user.id)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Une voix par délà le voile...")
            .setDescription(
              "Abaddon ne vous répond pas..."
            ),
        ],
      });
      return;
    }

    if (interaction.options.getSubcommand() === 'invoke') {
      if (!interaction.guildId) {
        await interaction.reply({
          flags: ["Ephemeral"],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Une voix par délà le voile...")
              .setDescription(
                "Le rituel utilisé pour l'invocation ne semble pas valide..."
              ),
          ],
        });
        return;
      }

      const channel = interaction.options.getChannel('voice-channel', true, [ChannelType.GuildVoice]);

      if (!channel || channel.type !== ChannelType.GuildVoice || !channel.guild) {
        await interaction.reply({
          flags: ["Ephemeral"],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Une voix par délà le voile...")
              .setDescription(
                "Le rituel utilisé pour l'invocation ne semble pas valide..."
              ),
          ],
        });
        return;
      }

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      await interaction.reply({
        flags: ["Ephemeral"],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Une voix par délà le voile...")
            .setDescription(
              "Une incarnation du Dieu des Secret nous rejoint !"
            ),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'revoke') {
      if (!interaction.guildId) {
        await interaction.reply({
          flags: ["Ephemeral"],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Une voix par délà le voile...")
              .setDescription(
                "Le rituel utilisé pour l'invocation ne semble pas valide..."
              ),
          ],
        });
        return;
      }

      const connection = getVoiceConnection(interaction.guildId);
      connection?.destroy();

      await interaction.reply({
        flags: ["Ephemeral"],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Une voix par délà le voile...")
            .setDescription(
              "L'incarnation du Dieu des Secret nous quitte..."
            ),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'say') {
      const text = interaction.options.getString('text', true);

      if (!interaction.guildId) {
        await interaction.reply({
          flags: ["Ephemeral"],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Une voix par délà le voile...")
              .setDescription(
                "Le rituel utilisé pour l'invocation ne semble pas valide..."
              ),
          ],
        });
        return;
      }

      const connection = getVoiceConnection(interaction.guildId);

      if (!connection) {
        await interaction.reply({
          flags: ["Ephemeral"],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle("Une voix par délà le voile...")
              .setDescription(
                "Aucun avatar n'est disponible pour s'exprimer."
              ),
          ],
        });
        return;
      }

      let audioSource: AudioResource;
      if (text === 'test') {
        audioSource = createAudioResource(path.join(process.cwd(), `./tmp/source.mp3`));
      } else {
        logger.info('Generating audio via ElevenLabs...');
        const audio = await elevenlabs.generate({
          voice: config.get('services.elevenlabs.voiceId'),
          text,
          model_id: "eleven_multilingual_v2",
        });
        logger.info('Audio generated! Creating source and playing it.');

        const readableStream = Readable.from(audio);

        audioSource = createAudioResource(readableStream);
      }

      const player = createAudioPlayer();

      connection.subscribe(player);

      player.play(audioSource);

      player.on(AudioPlayerStatus.AutoPaused, () => {
        logger.info('Player finished!');
        player.stop();
      });

      player.on(AudioPlayerStatus.Playing, () => {
        logger.info('Player playing!');
      });

      await interaction.reply({
        flags: ["Ephemeral"],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Une voix par délà le voile...")
            .setDescription(
              "L'avatar s'exprime..."
            ),
        ],
      });
    } else {
      await interaction.reply({
        flags: ["Ephemeral"],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle("Une voix par délà le voile...")
            .setDescription(
              "Le rituel utilisé pour l'invocation ne semble pas valide..."
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
          .setName('invoke')
          .addChannelOption(option =>
            option
              .setName('voice-channel')
              .setNameLocalizations({
                'fr': 'canal-vocal',
              })
              .setDescription("Le canal vocal où invoquer l'avatar.")
              .addChannelTypes(ChannelType.GuildVoice)
              .setRequired(true)
          )
          .setDescription("Conjurer un avatar du Dieu des Secrets.")
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('revoke')
          .setDescription("Renvoyer l'avatar dans le Néant.")
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('say')
          .addStringOption(option =>
            option
              .setName('text')
              .setNameLocalizations({
                'fr': 'texte',
              })
              .setDescription("Le texte à dire.")
              .setRequired(true)
          )
          .setDescription("Faire parler l'avatar.")
      )
      .setDescription('Conjure la puissance des Secrets.');
  }
}