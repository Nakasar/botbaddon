import { Command } from "../discord-bot.adapter";
import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import c from "config";

export class RollCommand implements Command {
  readonly name = "roll";

  async execute(interaction: ChatInputCommandInteraction) {
    const expression = interaction.options.getString('lancer');
    const comment = interaction.options.getString('commentaire');

    if (!expression) {
      await interaction.reply({ content: 'Expression de lancer invalide.', ephemeral: true });
      return;
    }

    const result = await evaluate(expression);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FF8000')
          .setTitle(`${interaction.user.username}${comment ? ` # ${comment}` : ''}`)
          .setDescription(
            `\`${result.expression}\` → \`${result.rolled}\` = **\`${
              result.result
            }\`**
                            ${result.result
              .toString()
              .split("")
              .map((digit: string) => digitToEmoji(digit))
              .join(" ")}    ${
              result.critFailure
                ? ":skull_crossbones: Echec Critique :skull_crossbones:"
                : ""
            }  ${result.critSuccess ? ":zap: Réussite Critique :zap:" : ""}`
          ),
      ],
    })
  }

  build(): SlashCommandBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .addStringOption(option =>
        option
          .setName('lancer')
          .setDescription('Dés à lancer, par exemple "1d6 + 4"')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('commentaire')
          .setDescription('Commentaire à ajouter au lancer')
          .setRequired(false)
      )
      .setDescription('Lancer des dés');
  }
}

async function evaluate(expression: string) {
  return Promise.resolve().then(() => {
    const regex = /^([+-]{0,1}\d{1,2}d\d{1,4}([+-]\d{1,4}){0,}){1,}$/;
    if (!regex.test(expression.toLowerCase().trim())) {
      throw {
        message: "Invalid expression to evaluate.",
        id: "INVALID_EXPRESSION"
      };
    }

    // Roll dices.
    const diceRegex = /\d{1,2}d\d{1,4}/g;
    let rolled;
    let critFailure = false;
    let critSuccess = false;
    try {
      rolled = expression.toLowerCase().replace(diceRegex, match => {
        const [amountRaw, diceRaw] = match.split("d");
        const amount = parseInt(amountRaw);
        const dice = parseInt(diceRaw);
        const res = [];

        for (let i = 0; i < amount; i++) {
          const rolled = Math.round(Math.random() * (dice - 1)) + 1;

          if (rolled > dice - dice / 20) {
            critSuccess = true;
          }
          if (rolled <= dice / 20) {
            critFailure = true;
          }

          res.push(`(${rolled})`);
        }

        return `(${res.join("+")})`;
      });
    } catch (e) {
      throw {
        message: "Could not roll dices.",
        id: "INVALID_EXPRESSION"
      };
    }

    let result;
    try {
      result = eval(rolled);
    } catch (e) {
      console.log(e);
      throw {
        message: "Could not evaluate rolled expression.",
        id: "INVALID_EXPRESSION"
      };
    }

    return {
      expression,
      rolled,
      result,
      critFailure,
      critSuccess,
    };
  });
}

function digitToEmoji(digit: string) {

  const digitEmojies: { [digit: string]: string } = {
    '-': ':heavy_minus_sign:',
    '0': ":zero:",
    '1': ":one:",
    '2': ":two:",
    '3': ":three:",
    '4': ":four:",
    '5': ":five:",
    '6': ":six:",
    '7': ":seven:",
    '8': ":eight:",
    '9': ":nine:"
  };
  return digitEmojies[digit];
}