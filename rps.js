import chalk from 'chalk';
import crypto from 'node:crypto';
import readline from 'node:readline';

class CryptoProvider {
  createHmac(algorithm, key) {
    return crypto.createHmac(algorithm, key);
  }

  randomBytes(size) {
    return crypto.randomBytes(size);
  }
}

class RPSHelper {
  static generateTable(moves) {
    const table = [];

    for (let i = 0; i < moves.length; i += 1) {
      const row = [moves[i]];
      for (let j = 0; j < moves.length; j += 1) {
        row.push(this.determineOutcome(i, j, moves.length));
      }
      table.push(row);
    }

    return table;
  }

  static determineOutcome(indexA, indexB, n) {
    const diff = (indexB - indexA + n) % n;
    if (diff === 0) {
      return 'Draw';
    } if (diff <= n / 2) {
      return 'Win';
    }
    return 'Lose';
  }

  static displayHelpTable(moves) {
    const table = this.generateTable(moves);
    const totalLength = 15 + (moves.length * 12);

    console.log(chalk.bold.yellowBright(`Results are from the user's point of view:`));

    this.printTableLine(totalLength);
    console.log(`| ${chalk.bold.magentaBright('v PC\\User >')}  | ${moves.map((move) => chalk.bold.greenBright(move.padEnd(9))).join(' | ')}|`);
    this.printTableLine(totalLength);

    for (let i = 0; i < table.length; i += 1) {
      const row = table[i];
      console.log(`| ${chalk.bold.greenBright(row[0].padEnd(13))}| ${row.slice(1).map((cell) => cell.padEnd(9)).join(' | ')}|`);
      this.printTableLine(totalLength);
    }
  }

  static printTableLine(totalLength) {
    const coloredLine = chalk.blueBright('+'.padEnd(totalLength, '*'));
    console.log(coloredLine);
  }
}

class GameController {
  constructor(game, moves) {
    this.game = game;
    this.moves = moves;
  }

  async playGame() {
    try {
      const computerMove = this.moves[Math.floor(Math.random() * this.moves.length)];
      const hmac = this.game.generateHMAC(computerMove);
      this.printGameIntro(hmac);
      this.printAvailableMoves();

      const userInput = await this.promptUser('Enter your move: ');

      if (userInput === '?') {
        this.displayHelp();
        return;
      }
      if (userInput === '0') {
        console.log(chalk.bold('Exiting...'));
        return;
      }

      const userMoveIndex = Number(userInput);
      const userMove = this.moves[userMoveIndex - 1];

      this.validateUserInput(userMoveIndex);

      console.log(chalk.bold(`Your move: ${userMove}`));
      console.log(chalk.bold(`Computer's move: ${computerMove}`));
      console.log(this.game.determineWinner(userMove, computerMove));
      console.log(chalk.magentaBright(`HMAC key: ${this.game.hmacKey}`));
    } catch (error) {
      this.handleError(error);
    }
  }

  printGameIntro(hmac) {
    console.log(chalk.greenBright('-------------------------------- RPS Game --------------------------------'));
    console.log(chalk.magentaBright(`HMAC: ${hmac}`));
  }

  printAvailableMoves() {
    console.log(chalk.cyanBright('Available moves:'));
    this.moves.forEach((move, index) => console.log(chalk.blueBright(`${index + 1} - ${move}`)));
    console.log(chalk.blueBright('0 - Exit'));
    console.log(chalk.blueBright('? - Help'));
  }

  async promptUser(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => rl.question(chalk.bold(question), (answer) => {
      rl.close();
      resolve(answer.trim());
    }));
  }

  displayHelp() {
    console.log(chalk.blue('Help Menu:'));
    RPSHelper.displayHelpTable(this.moves);
  }

  validateUserInput(userMoveIndex) {
    if (Number.isNaN(userMoveIndex) || userMoveIndex < 0 || userMoveIndex > this.moves.length) {
      throw new InvalidInputError(chalk.red('Please choose a valid move by entering an available number.'));
    }
  }

  handleError(error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}


class HMACGenerator {
  constructor(cryptoProvider) {
    this.cryptoProvider = cryptoProvider;
  }

  generateHMAC(move, hmacKey) {
    const hmacHash = this.cryptoProvider.createHmac('sha3-256', hmacKey);
    hmacHash.update(move);
    return hmacHash.digest('hex');
  }

  generateKey() {
    return this.cryptoProvider.randomBytes(32).toString('hex');
  }
}

class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

class GameLogic {
  constructor(moves) {
    this.moves = moves;
  }

  determineWinner(userMove, computerMove) {
    const n = this.moves.length;
    const half = Math.floor(n / 2);
    const userIndex = this.moves.indexOf(userMove);
    const computerIndex = this.moves.indexOf(computerMove);

    if (userIndex === -1 || computerIndex === -1) {
      throw new InvalidInputError(chalk.red('Please choose a valid move by entering an available number.'));
    }

    const winningMoves = this.moves.slice(computerIndex + 1, computerIndex + 1 + half)
      .concat(this.moves.slice(0, computerIndex - half));

    if (userMove === computerMove) {
      return chalk.yellowBright(`It's a draw!`);
    }
    if (winningMoves.includes(userMove)) {
      return chalk.greenBright('You won!');
    }
    return chalk.redBright('Computer won!');
  }
}

class RPSGame {
  constructor(moves, hmacGenerator, gameLogic) {
    this.moves = moves;
    this.hmacGenerator = hmacGenerator;
    this.gameLogic = gameLogic;
    this.hmacKey = hmacGenerator.generateKey();
  }

  generateHMAC(move) {
    return this.hmacGenerator.generateHMAC(move, this.hmacKey);
  }

  determineWinner(userMove, computerMove) {
    return this.gameLogic.determineWinner(userMove, computerMove);
  }
}

async function main() {
  const moves = process.argv.slice(2);

  try {
    if (moves.length < 3 || moves.length % 2 !== 1 || new Set(moves).size !== moves.length) {
      throw new InvalidInputError(chalk.red(`
    Please give an odd number (at least greater than or equal to 3) of non-repeating strings as moves.

    Valid Moves:
    - node rps.js Rock Paper Scissors
    - node rps.js Rock Paper Spock 4    5 6 7
    - node rps.js rock spock paper lizard scissors
    - node rps.js STONE SPOCK PAPER    LIZARD SCISSORS
    - node rps.js A B C D E F   G
    - node rps.js 1 2 3  4 5 6  7 8 9

    `));
    }

    const cryptoProvider = new CryptoProvider();
    const hmacGenerator = new HMACGenerator(cryptoProvider);
    const gameLogic = new GameLogic(moves);

    const game = new RPSGame(moves, hmacGenerator, gameLogic);
    const gameController = new GameController(game, moves);

    await gameController.playGame();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

main();
