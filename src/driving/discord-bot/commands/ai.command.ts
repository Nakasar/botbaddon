import { Command } from '../discord-bot.adapter';
import {
  ChannelType,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  SharedSlashCommand,
  SlashCommandBuilder,
} from 'discord.js';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import config from 'config';
import { ElevenLabsClient } from 'elevenlabs';
import logger from '../../../logger';
import path from 'node:path';
import { Readable } from 'node:stream';
import { WebSocket } from 'ws';

const elevenlabs = new ElevenLabsClient({
  apiKey: config.get('services.elevenlabs.apiKey'), // Defaults to process.env.ELEVENLABS_API_KEY
});

export class Instance {
  private socket?: WebSocket;
  public readonly player: AudioPlayer = createAudioPlayer();
  private messageId: string | null = null;
  private messages: Record<string, any>[] = [];
  private sequence: number = 0;

  constructor(
    private readonly agentId: string,
    public channelId: string,
  ) {
    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      logger.info('Player finished!');
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.info('Player playing!');
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.info('Player idle!');
      this.playNextMessage();
    });
  }

  async connect() {
    logger.info(`Connecting instance to ${this.channelId}`);

    this.socket = new WebSocket(
      `wss://api.avatar.lu/agents/${config.get('services.avatar.agentId')}/sockets`,
    );

    this.socket.addEventListener('message', (message) => {
      try {
        const event = JSON.parse(message.data.toString());

        switch (event.type) {
          case 'REQUEST_AUTHENTICATION':
            logger.info('Authenticating...');
            this.socket?.send(
              JSON.stringify({
                type: 'AUTHENTICATION_RESPONSE',
                authSecret: config.get('services.avatar.agentSecret'),
              }),
            );
            break;
          case 'AUTHENTICATION_SUCCESS':
            logger.info('Authentication successful!');
            break;
          case 'INPUT':
            break;
          case 'INTERRUPT':
            this.handleInterruptCommand();
            logger.info('Received INTERRUPT event', { event });
            this.player.stop();
            break;
          case 'SAY_FILLER':
            break;
          case 'SAY':
            logger.info('Received SAY event', { event });
            this.handleSayCommand(event);
            break;
          default:
            logger.warn('Received unhandled event', { event });
            break;
        }
      } catch (error: any) {
        logger.error('Error while handling agent socket event', {
          error: { message: error.message, stack: error.stack },
        });
      }
    });

    const pingInterval = setInterval(() => {
      this.socket?.send(JSON.stringify({ type: 'PING' }));
    }, 25000);
    this.socket.addEventListener('close', (event) => {
      console.log('Connection closed', { event });

      clearInterval(pingInterval);
    });
  }

  async handleInterruptCommand() {
    this.messageId = null;
    this.messages = [];
    this.sequence = 0;
    this.player.stop(true);
  }

  async handleSayCommand(message: Record<string, any>) {
    if (this.messageId !== message.messageId) {
      await this.handleInterruptCommand();
    }

    this.messageId = message.messageId;
    this.messages.push(message);

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNextMessage();
    }
  }

  async playNextMessage() {
    logger.debug('PLAYING NEXT MESSAGE', {
      messageId: this.messageId,
      sequence: this.sequence,
    });
    if (!this.messageId || this.messages.length === 0) {
      return;
    }

    const nextMessage = this.messages.find(
      (message) =>
        message.messageId === this.messageId &&
        message.sequence === this.sequence &&
        message.type === 'SAY',
    );

    if (!nextMessage) {
      if (
        !this.messages.find(
          (message) =>
            message.messageId === this.messageId && (message.sequence ?? 0) > this.sequence,
        )
      ) {
        logger.debug('FINISHED PLAYING AUDIO');
        await fetch(`https://api.avatar.lu/agents/${this.agentId}/status`, {
          method: 'POST',
          headers: {
            'x-api-key': `${this.agentId}:${config.get('services.avatar.agentSecret')}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'IDLE',
          }),
        }).then(() => {
          console.log('Marked connector as IDLE');
        });
        return;
      }

      return;
    }

    logger.debug('PLAYING MESSAGE', { nextMessage });

    if (nextMessage.audio?.src) {
      const audioSource = createAudioResource(nextMessage.audio.src);

      this.player.play(audioSource);
      this.sequence++;
    } else if (!nextMessage.final) {
      this.sequence++;
      this.playNextMessage();
    } else {
      this.sequence++;
      await fetch(`https://api.avatar.lu/agents/${this.agentId}/status`, {
        method: 'POST',
        headers: {
          'x-api-key': `${this.agentId}:${config.get('services.avatar.agentSecret')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'IDLE',
        }),
      }).then(() => {
        console.log('Marked connector as IDLE');
      });
      return;
    }
  }
}

export class AiCommand implements Command {
  readonly name = 'ai';

  async execute(interaction: ChatInputCommandInteraction) {
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

    if (interaction.options.getSubcommand() === 'invoke') {
      if (!interaction.guildId) {
        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Une voix par délà le voile...')
              .setDescription("Le rituel utilisé pour l'invocation ne semble pas valide..."),
          ],
        });
        return;
      }

      const channel = interaction.options.getChannel('voice-channel', true, [
        ChannelType.GuildVoice,
      ]);

      if (!channel || channel.type !== ChannelType.GuildVoice || !channel.guild) {
        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Une voix par délà le voile...')
              .setDescription("Le rituel utilisé pour l'invocation ne semble pas valide..."),
          ],
        });
        return;
      }

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      const instance = new Instance(config.get('services.avatar.agentId'), channel.id);
      connection.subscribe(instance.player);

      await instance.connect();

      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Une voix par délà le voile...')
            .setDescription('Une incarnation du Dieu des Secret nous rejoint !'),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'revoke') {
      if (!interaction.guildId) {
        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Une voix par délà le voile...')
              .setDescription("Le rituel utilisé pour l'invocation ne semble pas valide..."),
          ],
        });
        return;
      }

      const connection = getVoiceConnection(interaction.guildId);
      connection?.destroy();

      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Une voix par délà le voile...')
            .setDescription("L'incarnation du Dieu des Secret nous quitte..."),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'say') {
      const text = interaction.options.getString('text', true);

      if (!interaction.guildId) {
        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Une voix par délà le voile...')
              .setDescription("Le rituel utilisé pour l'invocation ne semble pas valide..."),
          ],
        });
        return;
      }

      const connection = getVoiceConnection(interaction.guildId);

      if (!connection) {
        await interaction.reply({
          flags: [MessageFlags.Ephemeral],
          embeds: [
            new EmbedBuilder()
              .setColor('#FF8000')
              .setTitle('Une voix par délà le voile...')
              .setDescription("Aucun avatar n'est disponible pour s'exprimer."),
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
          model_id: 'eleven_multilingual_v2',
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
        flags: [MessageFlags.Ephemeral],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Une voix par délà le voile...')
            .setDescription("L'avatar s'exprime..."),
        ],
      });
    } else if (interaction.options.getSubcommand() === 'ask') {
      const question = interaction.options.getString('question', true);

      await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#3d25a5')
              .setTitle(`${interaction.user.username} demande...`)
              .setDescription(question),
          ],
        });

      const result = await fetch(`https://api.breign.eu/agents/${config.get<string>('services.avatar.brainId')}/prompts`, {
        method: 'POST',
        headers: {
          'x-api-key': config.get<string>('services.avatar.apiKey'),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          message: question,
          lang: 'fr',
        }),
      });

      if (!result.ok) {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor('#8f0746')
              .setTitle('Une voix par délà le voile...')
              .setDescription("De mauvaises ondes interfèrent avec les Brumes... Isgarren doit veiller..."),
          ],
        });
      }
      const message = await result.json();

      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor('#8f0746')
            .setTitle('Une voix par délà le voile...')
            .setDescription(message.text),
        ],
      });
    } else {
      await interaction.reply({
        flags: [MessageFlags.Ephemeral],
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8000')
            .setTitle('Une voix par délà le voile...')
            .setDescription("Le rituel utilisé pour l'invocation ne semble pas valide..."),
        ],
      });
    }
  }

  build(): (ContextMenuCommandBuilder | SharedSlashCommand)[] {
    return [
      new SlashCommandBuilder()
        .setName(this.name)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('invoke')
            .addChannelOption((option) =>
              option
                .setName('voice-channel')
                .setNameLocalizations({
                  fr: 'canal-vocal',
                })
                .setDescription("Le canal vocal où invoquer l'avatar.")
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true),
            )
            .setDescription('Conjurer un avatar du Dieu des Secrets.'),
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('revoke').setDescription("Renvoyer l'avatar dans le Néant."),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('say')
            .addStringOption((option) =>
              option
                .setName('text')
                .setNameLocalizations({
                  fr: 'texte',
                })
                .setDescription('Le texte à dire.')
                .setRequired(true),
            )
            .setDescription("Faire parler l'avatar."),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('ask')
            .setNameLocalization('fr', 'demander')
            .addStringOption((option) =>
              option
                .setName('question')
                .setNameLocalizations({
                  fr: 'question',
                })
                .setDescription('Votre question')
                .setRequired(true),
            )
            .setDescription("Ask something to Bot'Baddon")
            .setDescriptionLocalization('fr', "Demander quelque chose à Bot'Baddon"),
        )
        .setDescription('Conjure la puissance des Secrets.'),
    ];
  }
}
