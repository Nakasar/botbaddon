import {
  ChatInputCommandInteraction,
  ColorResolvable,
  EmbedBuilder,
  SharedSlashCommand,
  SlashCommandBuilder
} from "discord.js";
import {Command} from "../discord-bot.adapter";

const colors: { name: string; code: ColorResolvable }[] = [
  { name: "Marron", code: '#61210B' },
  { name: "Noir", code: '#000000' },
  { name: "Violet", code: '#9A2EFE' },
  { name: "Jaune", code: '#FFFF00' },
  { name: "Vert", code: '#04B404' },
  { name: "Blanc", code: '#FFFFFF' },
  { name: "Rose", code: '#FA58F4' },
  { name: "Gris", code: '#BDBDBD' },
  { name: "Orange", code: '#FF8000' },
];
const tastes = ['Réglisse', 'Terre', 'Vinaigre', 'Pêche', 'Citron', 'Ananas', 'Myrtille', 'Fraise', 'Citron vert', 'Chocolat', 'Noisette', 'Choux de Bruxelles', 'Kiwi', 'Potiron', 'Concombre', "Cire d'abeille", 'Ail', 'Tomate', 'Miel', 'Savon', 'Pamplemousse', 'Clémentine', 'Orange', 'Courgette', 'Caramel', 'Nougat', 'Rhubarbe'];
const effects = [
  { name: 'Félin', description: 'Vous vous comportez similairement à un chat pendant dix minutes. (Certains sujets se montrent incapables de parler sous cet effet et se contentent de miauler.)' },
  { name: 'Pirate', description: 'Vous vous exprimez comme un pirate (montrez votre meilleure imitation !) pendant dix minutes. Yaaar !' },
  { name: 'Mr Mime', description: 'Vous êtes muet pendant dix minutes.' },
  { name: 'Planeur', description: "Vous avez l'impression que le sol tangue pendant dix minutes. C'est difficile de se déplacer, mais ça ne vous donne pas le mal de mer (c'est gentil quand même)." },
  { name: 'Dramaturge', description: 'Vous vous exprimez et vous comportez pendant dix minutes comme si vous étiez un acteur dans une pièce de théâtre, avec grandiloquénce, grand gestes, et apartés pour vos pensées.' },
  { name: 'Booh', description: "Vous prenez l'apparence d'un spectre." },
  { name: 'Joker', description: "Pendant dix minutes, appliquez l'effet de votre choix. Allez-y, impressionnez !" },
  { name: 'Le Néant', description: "Vous vous exprimez avec une voix d'outre tombe pendant dix minutes." },
  { name: "C'était de la bonne", description: "Vous êtes victime d'hallucinations pendant dix minutes. De quoi ? Soyez imaginatif !" },
  { name: 'Sans Gravité', description: 'La gravité vous affecte moins pendant dix minutes.' },
  { name: 'Ver Luisant', description: 'Vous devenez luisant pendant dix minutes. Espérons que vous ne comptiez pas vous cacher.' },
  { name: 'Collant', description: 'Vous collez à tout ce que vous touchez.' },
  { name: 'Doppelganger', description: ' Regardez sur votre droite. Vous vous prenez pour la première personne que vous voyez dans cette direction pendant dix minutes.' },
  { name: 'Sans Filtre', description: 'Vous dites tout ce qui vous passe par la tête pendant dix minutes. Même (et surtout) si vous auriez préféré le garder pour vous' },
  { name: 'Le Hoquet', description: 'Vous avez le hoquet pendant dix minutes.' },
  { name: 'Fortement Alcoolisé', description: "Vous êtes en état d'ébriété pendant dix minutes." },
  { name: 'La Vie En Rose', description: "Pendant dix minutes, vous voyez en nuances de roses. C'est mieux qu'en cinquantes nuances de gris quand même" },
  { name: 'Pétrifié', description: "Vous êtes paralysé pour une durée de dix minutes. Vous pouvez observer, parler, respirer... Mais pas bouger votre corps." },
  { name: 'Bulles', description: "Pendant dix minutes, à chaque fois que vous prenez la parole, des bulles de la couleur du bonbon s'échappe de votre bouche. Et vous en lâchez parfois avec un léger hoquet." },
  { name: 'Invisibilité', description: "Vous êtes invisible (pas vos vêtements et ce que vous portez par contre, c'était trop cher à faire), pendant dix minutes." },
  { name: "A l'en Vers", description: "Vous ne pouvez parler qu'en Alexandrin. Sinon vous ne parlez pas." },
  { name: 'Givré', description: "Effet givre (fraicheur) et souffle glacial" },
  { name: 'Farceur', description: "Vous vous sentez obligé de faire des farces à tout le monde autour de vous pendant dix minutes." },
  { name: 'La Vie En Rose', description: "Pendant dix minutes, vous voyez en nuances de roses. C'est mieux qu'en cinquantes nuances de gris quand même." },
];

function getCandy() {
  return {
    color: colors[Math.floor(Math.random() * colors.length)],
    taste: tastes[Math.floor(Math.random() * tastes.length)],
    effect: effects[Math.floor(Math.random() * effects.length)],
  };
}

export class BonbonCommand implements Command {
  readonly name = 'bonbon';

  async execute(interaction: ChatInputCommandInteraction) {
    const candy = getCandy();

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(candy.color.code)
          .setTitle("Bonbon !")
          .setDescription(
            `Tu as pioché un bonbon de couleur **${candy.color.name}** au goût **${candy.taste}**. Il a un petit effet spécial : **${candy.effect.name}**. ${candy.effect.description}`
          ),
      ],
    });
  }

  build(): SharedSlashCommand {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription("Piocher un bonbon aux effets particuliers !");
  }
}
