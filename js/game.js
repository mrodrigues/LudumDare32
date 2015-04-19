var WIDTH = 800;
var HEIGHT = 400;
var game = new Phaser.Game(WIDTH, HEIGHT, Phaser.AUTO, 'game');
var SPAWN_Y_OFFSET = 150;

var FONT = '"Courier New", Courier, monospace';

var alphabet = [];
for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
  alphabet.push(String.fromCharCode(keyCode));
}

var Letter = function (game) {
  Phaser.Text.call(this, game, 0, 0, '', {fill: "#ffffff", font: '32px ' + FONT});
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
  this.nextFire = 0;
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
  if (this.game.time.time < this.nextFire) { return; }
  var x = source.x + 10;
  var y = source.y + source.height / 2;
  var that = this;
  fireLetter = function (index) {
    that.getFirstExists(false).fire(word[index], x, y, that.letterSpeed);
    if (index > 0) {
      setTimeout(fireLetter, that.fireRate, index - 1);
    } else {
      that.game.setFreeToFire(true);
    }
  };
  this.game.setFreeToFire(false);
  setTimeout(fireLetter, 0, word.length - 1);
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
  this.reset(WIDTH, this.y);
  this.body.maxVelocity.x = speed;
  this.life = life;
};

Enemy.prototype.hit = function (letter) {
  this.body.velocity.x = this.recoil;
  this.life--;
  if (this.life <= 0) {
    this.kill();
    this.game.score++;
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
    this.game.clearUsedWords();
  }
};

Bonus.NullBonus = function () {};
Bonus.NullBonus.prototype.start = function () {};
Bonus.NullBonus.prototype.check = function () {};

var PhaserGame = function () {
  this.player = null;
  this.platforms = null;

  this.score = 0;
  this.scoreText = null;

  this.wordWeapon = null;
  this.weakEnemies = null;
  this.strongEnemies = null;
  this.nextEnemySpawn = 0;
  this.enemySpawnTime = 10000;

  this.words = null;
  this.wordSpawn = null;
  this.letters = [];
  this.currentFirstLetter = null;
  this.currentWordLabel = null;
  this.freeToFire = true;

  this.usedWords = [];
  this.usedWordsLabel = [];
  this.maxUsedWords = 50;

  this.energy = 9999;//20;
  this.nextEnergyTime = null;
  this.energyInterval = 5000;
  this.energyLabel = null;

  this.nextDifficultyTime = null;
  this.difficultyInterval = 20000;
  this.difficultyLabel = null;
  this.chanceOfWeakEnemy = 1.0;

  this.currentBonus = null;
  this.bonuses = [];
  this.bonusLabel = null;
  this.chanceOfBonus = 0.3;
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
    this.game.renderer.renderSession.roundPixels = true;
    this.physics.startSystem(Phaser.Physics.ARCADE);
  },

  preload: function () {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('bandit-1', 'assets/bandit-1.png');
    this.load.image('bandit-2', 'assets/bandit-2.png');
    this.load.spritesheet('player', 'assets/attorney.png', 32, 33);

    // Idéias para compactar o arquivo:
    // - enviar apenas uma string, com as palavras separadas por vírgula, e montar a estrutura aqui
    // - gzip
    game.load.json("words", "/data/words.json")
   },

  create: function () {
    this.nextDifficultyTime = this.game.time.time + this.difficultyInterval;
    this.nextEnergyTime = this.game.time.time + this.energyInterval;
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
    window.player = this.player;

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

    this.currentWordLabel = game.add.text(WIDTH / 2, 16, '', { font: '32px ' + FONT, fill: '#fff' });
    this.currentWordLabel.anchor.x = 0.5;

    this.words = game.cache.getJSON('words');

    for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
      var key = game.input.keyboard.addKey(keyCode);
      key.onDown.add(this.addLetter, this);
    }

    var enter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    enter.onDown.add(this.enterWord, this);

    var backspace = game.input.keyboard.addKey(Phaser.Keyboard.BACKSPACE);
    backspace.onDown.add(this.deleteLetter, this);

    this.weakEnemies = new Enemies(this, 'bandit-1', 2, 100);
    this.strongEnemies = new Enemies(this, 'bandit-2', 3, 120);

    this.wordSpawn = new Word(this);

    this.usedWordsLabel = this.add.text(8, 20, '', { font: 'bold 18px ' + FONT, fill: "#ffffff", wordWrap: true, wordWrapWidth: 250 });

    this.energyLabel = this.add.text(WIDTH - 50, 16, '', { font: '18px ' + FONT, fill: "#ffffff" });
    this.addToEnergy(0);

    this.difficultyLabel = this.add.text(WIDTH / 2, 80, 'DIFFICULTY INCREASED', { font: '18px ' + FONT, fill: "#ffffff" });
    this.difficultyLabel.anchor.x = 0.5;
    this.difficultyLabel.visible = false;

    this.bonusLabel = this.add.text(WIDTH / 2, 200, '', { font: '18px ' + FONT, fill: "#ffffff" });
    this.bonusLabel.anchor.x = 0.5;
    this.bonusLabel.visible = false;

    this.bonuses.push(new Bonus.EqualLength(this));

    this.nextRound();
  },

  update: function () {
    this.game.physics.arcade.collide(this.player, this.platforms);
    this.physics.arcade.overlap(this.wordSpawn, this.weakEnemies, this.hitEnemy, null, this);
    this.physics.arcade.overlap(this.player, this.weakEnemies, this.hitPlayer, null, this);
    this.physics.arcade.overlap(this.wordSpawn, this.strongEnemies, this.hitEnemy, null, this);
    this.physics.arcade.overlap(this.player, this.strongEnemies, this.hitPlayer, null, this);
    this.spawnEnemy();
    this.increaseDifficulty();
    this.giveEnergy();
  },

  enterWord: function () {
    if (!this.freeToFire) { return; }
    var word = this.word();
    var wordExists = this.words[word];
    var wordAlreadyUsed = this.usedWords.indexOf(word) > -1;

    var returnEnergy = true;
    this.paintUsedWordsLabels();
    if (!wordExists) {
      // TODO: sound
      console.log("Word doesn't exist!");
    } else if (wordAlreadyUsed) {
      // TODO: sound
      this.setUsedWordLabelColor(word, '#f00');
    } else {
      this.words[word] = true;
      this.wordSpawn.fire(this.player, word);
      this.addUsedWord(word);
      this.currentBonus.check(word);
      this.player.animations.play("speaking");
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
    if (!this.freeToFire) { return; }
    if (this.energy <= 0) { return; }
    var letter = String.fromCharCode(key.keyCode);
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

  displayWord: function () {
    this.currentWordLabel.text = this.word();
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
    if (this.game.time.time < this.nextEnemySpawn) { return; }
    if (Math.random() < this.chanceOfWeakEnemy) {
      this.weakEnemies.spawn();
    } else {
      this.strongEnemies.spawn();
    }
    var timeUntilNextSpawn = 1000 + Math.random() * this.enemySpawnTime;
    this.nextEnemySpawn = this.game.time.time + timeUntilNextSpawn;
  },

  hitPlayer: function (player, enemy) {
    // TODO: Game over!
  },

  setFreeToFire: function (value) {
    this.freeToFire = value;
    var that = this;
    player.animations.currentAnim.onLoop.addOnce(function() {
      that.player.animations.play("standing");
    });
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
    if (this.game.time.time < this.nextDifficultyTime) { return; }
    this.enemySpawnTime *= 0.9;
    this.chanceOfWeakEnemy *= 0.9;
    this.nextDifficultyTime = this.game.time.time + this.difficultyInterval;

    this.difficultyLabel.visible = true;
    var that = this;
    setTimeout(function() { that.difficultyLabel.visible = false; }, 1000);
  },

  setBonusLabel: function (label) {
    this.bonusLabel.text = label;
  },

  setUsedWordLabelColor: function (word, color) {
    var index = this.usedWordsLabel.text.indexOf(word);
    this.usedWordsLabel.addColor(color, index);
    this.usedWordsLabel.addColor('#fff', index + word.length);
  },

  paintUsedWordsLabels: function () {
    this.usedWordsLabel.clearColors();
  },

  giveEnergy: function () {
    if (this.game.time.time < this.nextEnergy) { return; }
    this.addToEnergy(1);
    this.nextEnergy = this.game.time.time + this.energyInterval;
  }

}

game.state.add('Game', PhaserGame, true);
