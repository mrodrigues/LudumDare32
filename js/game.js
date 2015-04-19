var game = new Phaser.Game(640, 400, Phaser.AUTO, 'game');

var alphabet = [];
for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
  alphabet.push(keyCode);
}

var Letter = function (game, letter) {
  Phaser.Text.call(this, game, 0, 0, letter, {fill: "#ffffff"});
  this.texture.baseTexture.scaleMode = PIXI.scaleModes.NEAREST;
  this.anchor.set(0.5);
  this.checkWorldBounds = true;
  this.outOfBoundsKill = true;
  this.exists = false;
  window.letter = this;
};

Letter.prototype = Object.create(Phaser.Text.prototype);
Letter.prototype.constructor = Letter;

Letter.prototype.fire = function (x, y, speed) {
  this.reset(x, y);
  this.scale.set(1);
  this.game.physics.arcade.velocityFromAngle(0, speed, this.body.velocity);
};

var Word = function (game, word) {
  Phaser.Group.call(this, game, game.world, 'Word', false, true, Phaser.Physics.ARCADE);
  this.nextFire = 0;
  this.letterSpeed = 800;
  this.fireRate = 300;
  for (var i = word.length; i > 0; i--) {
    this.add(new Letter(game, word[i - 1]));
  }
  return this;
};

Word.prototype = Object.create(Phaser.Group.prototype);
Word.prototype.constructor = Word;

Word.prototype.fire = function (source) {
  if (this.game.time.time < this.nextFire) { return; }
  var x = source.x + 10;
  var y = source.y + 10;
  var that = this;
  fireLetter = function (index) {
    that.children[index].fire(x, y, this.letterSpeed);
    if (index + 1 < that.length) {
      setTimeout(fireLetter, that.fireRate, index + 1);
    }
  };
  setTimeout(fireLetter, 0, 0);
};

var PhaserGame = function () {
  this.player = null;
  this.platforms = null;
  this.cursors = null;
  this.stars = null;
  this.score = 0;
  this.scoreText = null;
  this.currentWordText = null;
  this.wordWeapon = null;

  this.words = null;
  this.letters = [];
  this.currentFirstLetter = 'H';
}

PhaserGame.prototype = {

  // Mudanças drásticas:
  // - Estilo scrabble, o jogador ganha algumas letras e tem que formar palavras (difícil de implementar a seleção das letras)
  // - (*** Curti!) Energia para usar as letras (ganha-se energia acertando inimigos ou com o tempo, então gastar uma palavra grande é um desperdício considerável)

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
    //this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/star.png');
    this.load.spritesheet('dude', 'assets/dude.png', 32, 48);
    this.load.image('bullet5', 'assets/bullet5.png');

    //////////////////////////
    // Idéias para compactar o arquivo:
    // - enviar apenas uma string, com as palavras separadas por vírgula, e montar a estrutura aqui
    // - gzip
    game.load.json("words", "/data/words.json")
    //////////////////////////
   },

  create: function () {
    //  A simple background for our game
    //this.add.sprite(0, 0, 'sky');

    //  The platforms group contains the ground and the 2 ledges we can jump on
    this.platforms = game.add.group();

    //  We will enable physics for any object that is created in this group
    this.platforms.enableBody = true;

    // Here we create the ground.
    var ground = this.platforms.create(0, game.world.height - 64, 'ground');

    //  Scale it to fit the width of the game (the original sprite is 400x32 in size)
    ground.scale.setTo(2, 2);

    //  This stops it from falling away when you jump on it
    ground.body.immovable = true;

    // The player and its settings
    this.player = this.add.sprite(32, game.world.height - 150, 'dude');

    //  We need to enable physics on the player
    this.physics.arcade.enable(this.player);

    //  Player physics properties. Give the little guy a slight bounce.
    this.player.body.bounce.y = 0.2;
    this.player.body.gravity.y = 2000;
    this.player.body.collideWorldBounds = true;

    //  Our two animations, walking left and right.
    this.player.animations.add('left', [0, 1, 2, 3], 10, true);
    this.player.animations.add('right', [5, 6, 7, 8], 10, true);

    //  The score
    this.scoreText = game.add.text(16, 16, 'score: 0', { fontSize: '32px', fill: '#000' });
    this.currentWordText = game.add.text(200, 16, '', { fontSize: '32px', fill: '#fff' });

    //////////////////////////
    this.words = game.cache.getJSON('words');

    for (var keyCode = Phaser.Keyboard.A; keyCode <= Phaser.Keyboard.Z; keyCode++) {
      alphabet.push(keyCode);
      var key = game.input.keyboard.addKey(keyCode);
      key.onDown.add(this.addLetter, this);
    }

    var enter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    enter.onDown.add(this.enterWord, this);

    var backspace = game.input.keyboard.addKey(Phaser.Keyboard.BACKSPACE);
    backspace.onDown.add(this.deleteLetter, this);
    //////////////////////////
  },

  update: function () {
    this.game.physics.arcade.collide(this.player, this.platforms);
  },

  enterWord: function () {
    var word = this.letters.join('');
    var wordState = this.words[word];
    console.log(word);

    if (!word.startsWith(this.currentFirstLetter)) {
      console.log("Should start with a '" + this.currentFirstLetter + "'!");
    } else if (wordState == undefined) {
      console.log("Word doesn't exist!");
    } else if (!wordState) {
      this.words[word] = true;
      this.score += word.length;
      console.log("Score: "+ this.score);
      new Word(this, word).fire(this.player);
    } else {
      console.log("Word already used!");
    }
    this.letters = [];
    this.displayWord();
  },

  addLetter: function (key) {
    var letter = String.fromCharCode(key.keyCode);
    this.letters.push(letter);
    this.displayWord();
  },

  deleteLetter: function () {
    this.letters.pop();
    this.displayWord();
  },

  displayWord: function () {
    this.currentWordText.text = this.word();
  },

  word: function () {
    return this.letters.join('');
  }

}

game.state.add('Game', PhaserGame, true);

