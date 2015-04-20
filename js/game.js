var WIDTH = 800;
var HEIGHT = 400;
var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, 'game');
var SPAWN_Y_OFFSET = 150;

var FONT = '"Courier New", Courier, monospace';
var RED = '#f38';
var WHITE = '#fff';

var alphabet = [];
for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
  alphabet.push(String.fromCharCode(keyCode));
}

var Letter = function (game) {
  Phaser.Text.call(this, game, 0, 0, '', {fill: WHITE, font: '32px ' + FONT});
  this.texture.baseTexture.scaleMode = PIXI.scaleModes.NEAREST;
  this.anchor.set(0.5);
  this.checkWorldBounds = true;
  this.outOfBoundsKill = true;
  this.exists = false;
};

Letter.prototype = Object.create(Phaser.Text.prototype);
Letter.prototype.constructor = Letter;

Letter.prototype.fire = function (letter, x, y, speed) {
  this.text = letter;
  this.reset(x, y);
  this.scale.set(1);
  this.game.physics.arcade.velocityFromAngle(0, speed, this.body.velocity);
};

var Word = function (game) {
  Phaser.Group.call(this, game, game.world, 'Word', false, true, Phaser.Physics.ARCADE);
  this.letterSpeed = 200;
  this.fireRate = 300;
  for (var i = 0; i < 100; i++) {
    this.add( new Letter(game));
  }
  return this;
};

Word.prototype = Object.create(Phaser.Group.prototype);
Word.prototype.constructor = Word;

Word.prototype.fire = function (source, word) {
  var x = source.x + 10;
  var y = source.y + source.height / 2;
  var that = this;
  var index = word.length - 1;
  fireLetter = function () {
    that.getFirstExists(false).fire(word[index], x, y, that.letterSpeed);
    if (index <= 0) {
      that.game.setFreeToFire(true);
    }
    index--;
  };
  this.game.setFreeToFire(false);
  fireLetter();
  this.game.delayedRunRepeat(this.fireRate, word.length - 1, fireLetter);
};

var Enemy = function (game, spriteKey) {
  Phaser.Sprite.call(this, game, 0, 0, spriteKey);
  this.texture.baseTexture.scaleMode = PIXI.scaleModes.NEAREST;
  this.scale.x = -1;
  this.anchor.set(0.5);
  this.exists = false;
  this.life = null;
  this.speed = null;
  this.y = game.world.height - SPAWN_Y_OFFSET;
  this.acceleration = 200;
  this.recoil = 50;

  this.floor = game.platforms;

  game.physics.arcade.enable(this);

  this.body.gravity.y = 2000;
};

Enemy.prototype = Object.create(Phaser.Sprite.prototype);
Enemy.prototype.constructor = Enemy;

Enemy.prototype.spawn = function (speed, life) {
  this.reset(WIDTH - 1, this.y);
  this.body.maxVelocity.x = speed;
  this.life = life;
};

Enemy.prototype.hit = function (letter) {
  this.game.sound.play('hit');
  this.body.velocity.x = this.recoil;
  this.life--;
  if (this.life <= 0) {
    this.kill();
    this.game.increaseScore();
  }
};

Enemy.prototype.update = function () {
  if (this.exists) {
    this.game.physics.arcade.collide(this, this.floor);
    this.body.acceleration.x = -this.acceleration;
  }
};

Enemies = function (game, spriteKey, enemyLife, enemySpeed) {
  Phaser.Group.call(this, game, game.world, 'Enemies', false, true, Phaser.Physics.ARCADE);

  this.enemySpeed = enemySpeed;
  this.enemyLife = enemyLife;

  for (var i = 0; i < 64; i++)
  {
    this.add(new Enemy(game, spriteKey), true);
  }

  return this;
};

Enemies.prototype = Object.create(Phaser.Group.prototype);
Enemies.prototype.constructor = Enemies;

Enemies.prototype.spawn = function () {
  this.getFirstExists(false).spawn(this.enemySpeed, this.enemyLife);
};

var Bonus = {};

Bonus.EqualLength = function (game) {
  this.game = game;
};

Bonus.EqualLength.prototype.constructor = Bonus.EqualLength;

Bonus.EqualLength.prototype.start = function () {
  this.length = Math.round(Math.random() * 6) + 5;
  this.game.setBonusLabel('' + this.length + ' CHARACTERS');
};

Bonus.EqualLength.prototype.check = function (word) {
  if (word.length == this.length) {
    this.game.sound.play('bonus');
    this.game.clearUsedWords();
  }
};

Bonus.NullBonus = function () {};
Bonus.NullBonus.prototype.start = function () {};
Bonus.NullBonus.prototype.check = function () {};

var PhaserGame = function () {
  this.player = null;
  this.platforms = null;

  this.score = null;
  this.scoreLabel = null;

  this.wordWeapon = null;
  this.weakEnemies = null;
  this.strongEnemies = null;
  this.nextEnemySpawnEvent = null;
  this.enemySpawnTime = null;

  this.words = null;
  this.wordSpawn = null;
  this.letters = null;
  this.currentFirstLetter = null;
  this.currentWordLabel = null;
  this.currentWordLengthLabel = null;
  this.freeToFire = null;

  this.usedWords = null;
  this.usedWordsLabel = null;
  this.maxUsedWords = 50;

  this.energy = null;
  this.nextEnergyTimeEvent = null;
  this.energyInterval = 5000;
  this.energyLabel = null;

  this.nextDifficultyTimeEvent = null;
  this.difficultyInterval = 20000;
  this.difficultyLabel = null;
  this.chanceOfWeakEnemy = null;

  this.currentBonus = null;
  this.bonuses = [];
  this.bonusLabel = null;
  this.chanceOfBonus = 0.3;

  this.alertLabel = null;

  this.firstCharacter = true;

  this.pauseScreen = null;

  this.bgMusic = null;
}

PhaserGame.prototype = {

  // Mudanças drásticas:
  // - Estilo scrabble, o jogador ganha algumas letras e tem que formar palavras (difícil de implementar a seleção das letras)

  // Idéias para desafios:
  // - Acertar palavra com o número dado de letras
  // - Três palavras seguidas com o mesmo número de letras (ou com uma letra de diferença entre cada uma, etc)
  // - Chefão que joga palavras também (devem ser derrotadas com palavras iguais ou maiores)

  // Ideias para bônus:
  // - Apagar o backlog de palavras usadas (ou apenas as últimas X palavras)
  // - Vida?
  // - Energia?

  init: function () {
    this.physics.startSystem(Phaser.Physics.ARCADE);
    this.score = 0;
  },

  preload: function () {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('pause', 'assets/pause.png');

    this.load.image('bandit-1', 'assets/bandit-1.png');
    this.load.image('bandit-2', 'assets/bandit-2.png');
    this.load.spritesheet('player', 'assets/attorney.png', 32, 33);

    this.load.audio('bgMusic', 'assets/bgMusic.wav');
    this.load.audio('hit', 'assets/hit.wav');
    this.load.audio('missWord', 'assets/missWord.wav');
    this.load.audio('fireWord', 'assets/fireWord.wav');
    this.load.audio('bonus', 'assets/bonus.wav');
    this.load.audio('gameOver', 'assets/gameOver.wav');
    this.load.audio('cantType', 'assets/cantType.wav');

    // Idéias para compactar o arquivo:
    // - enviar apenas uma string, com as palavras separadas por vírgula, e montar a estrutura aqui
    // - gzip
   },

  create: function () {
    this.enemySpawnTime = 10000;
    this.letters = [];
    this.freeToFire = true;
    this.usedWords = [];
    this.usedWordsLabel = [];
    this.energy = 10;
    this.chanceOfWeakEnemy = 1.0;

    this.bgMusic = this.game.sound.add('bgMusic', 1, true);
    this.bgMusic.play();

    //this.game.sound.add('hit');
    //this.game.sound.add('missWord');
    //this.game.sound.add('fireWord', 0.1);
    //this.game.sound.add('bonus');
    //this.game.sound.add('gameOver');
    //this.game.sound.add('cantType');

    var timer = this.game.time.create();
    this.nextDifficultyTimeEvent = timer.loop(this.difficultyInterval, this.increaseDifficulty, this);
    this.nextEnergyTimeEvent = timer.loop(this.energyInterval, this.giveEnergy, this);
    this.nextEnemySpawnEvent = timer.loop(1000, this.spawnEnemy, this);
    timer.start();

    //  A simple background for our game
    this.add.sprite(0, 0, 'sky');

    //  The platforms group contains the ground and the 2 ledges we can jump on
    this.platforms = this.game.add.group();

    //  We will enable physics for any object that is created in this group
    this.platforms.enableBody = true;

    // Here we create the ground.
    var ground = this.platforms.create(0, game.world.height - 64, 'ground');

    //  Scale it to fit the width of the game (the original sprite is 400x32 in size)
    ground.scale.setTo(2, 2);

    //  This stops it from falling away when you jump on it
    ground.body.immovable = true;

    // The player and its settings
    this.player = this.add.sprite(180, game.world.height - SPAWN_Y_OFFSET, 'player');

    //  We need to enable physics on the player
    this.physics.arcade.enable(this.player);

    //  Player physics properties. Give the little guy a slight bounce.
    this.player.body.bounce.y = 0.2;
    this.player.body.gravity.y = 2000;
    this.player.body.collideWorldBounds = true;

    //  Our two animations, walking left and right.
    this.player.animations.add('standing', [0], 1, false);
    this.player.animations.add('speaking', [0, 1, 2, 1], 5, true);
    this.player.animations.play('standing');

    this.currentWordLabel = this.game.add.text(WIDTH / 2, 16, '', { font: '32px ' + FONT, fill: WHITE });
    this.currentWordLabel.anchor.x = 0.5;

    this.currentWordLengthLabel = this.game.add.text(WIDTH / 2, 48, '1', { font: '18px ' + FONT, fill: WHITE });
    this.currentWordLengthLabel.anchor.x = 0.5;

    this.words = WORDS;

    for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
      var key = game.input.keyboard.addKey(keyCode);
      key.onDown.add(this.addLetter, this);
    }

    var enter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    enter.onDown.add(this.enterWord, this);

    var backspace = game.input.keyboard.addKey(Phaser.Keyboard.BACKSPACE);
    backspace.onDown.add(this.deleteLetter, this);

    var esc = game.input.keyboard.addKey(Phaser.Keyboard.ESC);
    esc.onDown.add(this.resetWord, this);

    var spacebar = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    spacebar.onDown.add(this.pauseGame, this);

    this.weakEnemies = new Enemies(this, 'bandit-1', 2, 30);
    this.strongEnemies = new Enemies(this, 'bandit-2', 3, 50);

    this.wordSpawn = new Word(this);

    this.usedWordsLabel = this.add.text(8, 20, '', { font: 'bold 18px ' + FONT, fill: WHITE, wordWrap: true, wordWrapWidth: 250 });

    var energyTextLabel = this.add.text(WIDTH - 50, 16, 'ENERGY', { font: '18px ' + FONT, fill: WHITE });
    energyTextLabel.anchor.x = 0.5;
    this.energyLabel = this.add.text(WIDTH - 50, 40, '', { font: '18px ' + FONT, fill: WHITE });
    this.energyLabel.anchor.x = 0.5;
    this.addToEnergy(0);

    var scoreTextLabel = this.add.text(WIDTH - 50, 76, 'JAILED', { font: '18px ' + FONT, fill: WHITE });
    scoreTextLabel.anchor.x = 0.5;
    this.scoreLabel = this.add.text(WIDTH - 50, 100, '0', { font: '18px ' + FONT, fill: WHITE });
    this.scoreLabel.anchor.x = 0.5;

    this.difficultyLabel = this.add.text(WIDTH / 2, 80, 'DIFFICULTY INCREASED', { font: '18px ' + FONT, fill: WHITE });
    this.difficultyLabel.anchor.x = 0.5;
    this.difficultyLabel.visible = false;

    this.bonusLabel = this.add.text(WIDTH / 2, 200, '', { font: '18px ' + FONT, fill: WHITE });
    this.bonusLabel.anchor.x = 0.5;
    this.bonusLabel.visible = false;

    this.bonuses.push(new Bonus.EqualLength(this));

    this.alertLabel = this.add.text(WIDTH / 2, 120, '', { font: '18px ' + FONT, fill: RED });
    this.alertLabel.anchor.x = 0.5;
    this.alertLabel.visible = false;

    this.nextRound();

    this.pauseScreen = this.add.sprite(0, 0, 'pause');
    this.pauseScreen.alpha = 0.3;
    this.pauseScreen.visible = false;
  },

  update: function () {
    this.game.physics.arcade.collide(this.player, this.platforms);
    this.physics.arcade.overlap(this.wordSpawn, this.weakEnemies, this.hitEnemy, null, this);
    this.physics.arcade.overlap(this.player, this.weakEnemies, this.hitPlayer, null, this);
    this.physics.arcade.overlap(this.wordSpawn, this.strongEnemies, this.hitEnemy, null, this);
    this.physics.arcade.overlap(this.player, this.strongEnemies, this.hitPlayer, null, this);
  },

  enterWord: function () {
    if (!this.freeToFire) { return; }
    var word = this.word();
    var wordExists = this.words[word];
    var wordAlreadyUsed = this.usedWords.indexOf(word) > -1;

    var returnEnergy = true;
    this.paintUsedWordsLabels();
    if (!wordExists) {
      this.game.sound.play('missWord');
      this.showAlert("Word doesn't exist");
    } else if (wordAlreadyUsed) {
      this.game.sound.play('missWord');
      this.setUsedWordLabelColor(word, RED);
      this.showAlert("Word recently used");
    } else {
      this.game.sound.play('fireWord', 0.6);
      this.words[word] = true;
      this.wordSpawn.fire(this.player, word);
      this.addUsedWord(word);
      this.currentBonus.check(word);
      returnEnergy = false;
    }
    if (returnEnergy) {
      this.addToEnergy(this.letters.length);
    }
    this.nextRound();
  },

  nextRound: function () {
    var i = Math.floor(Math.random() * alphabet.length);
    this.currentFirstLetter = alphabet[i];
    this.letters = [];
    this.firstCharacter = true;
    this.displayWord();

    if (Math.random() < this.chanceOfBonus) {
      var i = Math.floor(Math.random() * this.bonuses.length);
      this.currentBonus = this.bonuses[i];
      this.currentBonus.start();
      this.bonusLabel.visible = true;
    } else {
      this.currentBonus = new Bonus.NullBonus();
      this.bonusLabel.visible = false;
    }
  },

  addLetter: function (key) {
    if (!this.freeToFire) {
      this.game.sound.play('cantType');
      this.showAlert('Wait for the word to stop firing');
      return;
    }
    if (this.energy <= 0) {
      this.game.sound.play('cantType');
      this.showAlert('Out of energy');
      this.flashLabel(this.energyLabel, WHITE, RED);
      return;
    }
    var letter = String.fromCharCode(key.keyCode);
    if (letter == this.currentFirstLetter && this.firstCharacter) {
      this.firstCharacter = false;
      return;
    }
    this.firstCharacter = false;
    this.letters.push(letter);
    this.addToEnergy(-1);
    this.displayWord();
  },

  deleteLetter: function () {
    if (this.letters.length > 0) {
      this.addToEnergy(1);
    }
    this.letters.pop();
    this.displayWord();
  },

  resetWord: function () {
    this.addToEnergy(this.letters.length);
    this.letters = [];
    this.displayWord();
  },

  displayWord: function () {
    this.currentWordLabel.text = this.word();
    this.currentWordLengthLabel.text = '' + this.word().length;
  },

  word: function () {
    return this.currentFirstLetter + this.letters.join('');
  },

  hitEnemy: function (letter, enemy) {
    enemy.hit(letter);
    letter.kill();
    this.addToEnergy(1);
  },

  spawnEnemy: function () {
    if (Math.random() < this.chanceOfWeakEnemy) {
      this.weakEnemies.spawn();
    } else {
      this.strongEnemies.spawn();
    }
    var timeUntilNextSpawn = 1000 + Math.random() * this.enemySpawnTime;
    this.nextEnemySpawnEvent.delay = timeUntilNextSpawn;
  },

  hitPlayer: function (player, enemy) {
    this.game.sound.play('gameOver');
    this.bgMusic.stop();
    this.game.state.start('GameOver');
  },

  setFreeToFire: function (value) {
    this.freeToFire = value;
    if (value) {
      var that = this;
      this.player.animations.currentAnim.onLoop.addOnce(function() {
        that.player.animations.play("standing");
      });
    } else {
      this.player.animations.play("speaking");
    }
  },

  addUsedWord: function (word) {
    if (this.usedWords.length + 1 > this.maxUsedWords) {
      this.usedWords.shift();
    }
    this.usedWords.push(word);
    this.displayUsedWords();
  },

  clearUsedWords: function () {
    this.usedWords = [];
    this.displayUsedWords();
  },

  displayUsedWords: function () {
    this.usedWordsLabel.text = this.usedWords.join(', ');
  },

  addToEnergy: function (value) {
    this.energy += value;
    this.energyLabel.text = '' + this.energy;
  },

  increaseDifficulty: function () {
    this.enemySpawnTime *= 0.9;
    this.chanceOfWeakEnemy *= 0.9;

    this.difficultyLabel.visible = true;
    var that = this;
    this.delayedRunOnce(1000, function() { that.difficultyLabel.visible = false; });
  },

  setBonusLabel: function (label) {
    this.bonusLabel.text = 'BONUS: ' + label;
  },

  setUsedWordLabelColor: function (word, color) {
    var index = this.usedWordsLabel.text.indexOf(word);
    this.usedWordsLabel.addColor(color, index);
    this.usedWordsLabel.addColor(WHITE, index + word.length);
  },

  paintUsedWordsLabels: function () {
    this.usedWordsLabel.clearColors();
  },

  giveEnergy: function () {
    this.addToEnergy(1);
  },

  showAlert: function (text) {
    this.alertLabel.text = text;
    this.alertLabel.visible = true;
    var that = this;
    this.delayedRunOnce(500, function () { that.alertLabel.visible = false; });
  },

  flashLabel: function (label, originalColor, color) {
    label.fill = color;
    this.delayedRunOnce(500, function () { label.fill = originalColor; });
  },

  increaseScore: function () {
    this.score++;
    this.scoreLabel.text = '' + this.score;
  },

  pauseGame: function () {
    this.game.paused = !this.game.paused;
    this.pauseScreen.visible = this.game.paused;
  },

  delayedRunOnce: function (delay, callback) {
    var timer = this.game.time.create(true);
    timer.add(delay, callback);
    timer.start();
  },

  delayedRunRepeat: function (delay, repeatCount, callback) {
    if (repeatCount <= 0) { return; }
    var timer = this.game.time.create(true);
    timer.repeat(delay, repeatCount, callback);
    timer.start();
  }
}

var GameOver = function () { };
GameOver.prototype = {
  create: function () {
    var gameOverText = this.game.add.text(WIDTH / 2, 32, 'GAME OVER', { font: '32px ' + FONT, fill: WHITE });
    gameOverText.anchor.set(0.5);

    var scoreText = this.game.add.text(WIDTH / 2, HEIGHT / 2, 'BANDITS JAILED: ' + this.game.state.states.Game.score, { font: '32px ' + FONT, fill: WHITE });
    scoreText.anchor.set(0.5);

    this.game.input.keyboard.onDownCallback = function () {
      this.game.state.start('Game');
      this.game.input.keyboard.onDownCallback = null;
    };
  }
};

var TitleScreen = function () {
  this.screens = [];
  this.currentScreen = 0;
  this.tutorialsNumber = 4;
};
TitleScreen.prototype = {
  preload: function () {
    this.load.image('title', 'assets/title.png');
    for (var i = 1; i <= this.tutorialsNumber; i++) {
      this.load.image('tutorial' + i, 'assets/tutorial' + i + '.png');
    }
  },

  create: function () {
    this.screens.push(this.add.sprite(0, 0, 'title'));
    for (var i = 1; i <= this.tutorialsNumber; i++) {
      var tutorial = this.add.sprite(0, 0, 'tutorial' + i);
      tutorial.visible = false;
      this.screens.push(tutorial);
    }

    var that = this;
    this.game.input.keyboard.onDownCallback = function () {
      if (that.currentScreen + 1 < that.screens.length) {
        that.screens[that.currentScreen].visible = false;
        that.currentScreen++;
        that.screens[that.currentScreen].visible = true;
      } else {
        that.game.state.start('Game');
        that.game.input.keyboard.onDownCallback = null;
      }
    };
  },
};

game.state.add('TitleScreen', TitleScreen, true);
game.state.add('Game', PhaserGame);
game.state.add('GameOver', GameOver);
