var bird;
var birdGravity = 400;
var birdSpeed = 125;
var birdFlapPower = 200;
var pipeInterval = 3000;
var pipeHole = 120;
var pipeGroup;
var score = 0;
var scoreText;
var topScore;
var button;

var audioContext = null;
var meter = null;
var WIDTH = 500;
var HEIGHT = 50;
var rafID = null;
var gameOver = false;

var topScorers = [];
var topScorersText;

var lightningElements = [];
var lastLightningScore = 0;

// Make game global
var game;

window.onload = function () {
  //======microphone setup
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();

  // Modern getUserMedia API
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      })
      .then(gotStream)
      .catch(function (error) {
        console.log("Microphone access denied or not available:", error);
      });
  } else {
    // Fallback for older browsers
    try {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          {
            audio: {
              mandatory: {
                googEchoCancellation: "false",
                googAutoGainControl: "false",
                googNoiseSuppression: "false",
                googHighpassFilter: "false",
              },
              optional: [],
            },
          },
          gotStream,
          didntGetStream
        );
      }
    } catch (e) {
      console.log("getUserMedia threw exception:", e);
    }
  }

  //======game setup
  game = new Phaser.Game(1300, 800, Phaser.CANVAS);
  window.game = game; // Make globally accessible

  var play = function (game) {};

  var hasShaken = false;

  play.prototype = {
    preload: function () {
      game.load.image("bird", "assets/bird-2.png");
      game.load.image("pipe", "assets/pipe1.png");
      game.load.image("button", "assets/start-1.png");
      game.load.image("bg", "assets/game-bg2.png");
      game.load.image("trail", "assets/trail.png");
      game.load.image("gameOver", "assets/game-over.png");
      game.load.image("restartButton", "assets/retry.png");
      game.load.audio("startSound", "assets/Sounds/game-start.mp3");
      game.load.audio("gameScoreSound", "assets/Sounds/scoring.mp3");
    },

    create: function () {
      game.paused = true;
      var background = game.add.sprite(0, 0, "bg");
      background.width = game.width;
      background.height = game.height;

      // Create start button
      button = game.add.button(
        game.world.centerX - 95,
        630,
        "button",
        actionOnClick,
        this,
        2,
        1,
        0
      );
      window.button = button; // Make globally accessible

      pipeGroup = game.add.group();
      score = 0;
      topScore =
        localStorage.getItem("topFlappyScore") == null
          ? 0
          : localStorage.getItem("topFlappyScore");
      scoreText = game.add.text(10, 10, "-", {
        font: "bold 32px Arial",
        fill: "#5ed2fd",
      });

      updateScore();
      game.stage.backgroundColor = "#87CEEB";
      game.stage.disableVisibilityChange = true;
      game.physics.startSystem(Phaser.Physics.ARCADE);
      bird = game.add.sprite(80, 240, "bird");
      bird.anchor.set(0.5);
      game.physics.arcade.enable(bird);
      bird.body.gravity.y = birdGravity;

      game.time.events.loop(pipeInterval, addPipe);
      addPipe();

      loadTopScorers();

      topScorersText = game.add.text(game.width - 200, 10, "Top High Scorers", {
        font: "bold 24px Arial",
        fill: "#5ed2fd",
      });
      updateTopScorersDisplay();

      this.startSound = game.add.audio("startSound");
      this.scoreSound = game.add.audio("gameScoreSound");

      // ===== INPUT HANDLING =====
      // Enable all input types
      game.input.enabled = true;
      game.input.touch.enabled = true;
      game.input.mspointer.enabled = true;

      // Flap function
      var performFlap = function () {
        if (!gameOver && bird && bird.body && !game.paused) {
          console.log("✅ FLAP TRIGGERED!");
          bird.body.velocity.y = -birdFlapPower * 1.53;
        }
      };

      // Phaser's built-in input (works for mouse)
      game.input.onDown.add(performFlap, this);

      // Keyboard (spacebar)
      this.spaceKey = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
      this.spaceKey.onDown.add(performFlap, this);

      // Canvas touch/pointer events
      var canvas = game.canvas;

      // Touch events
      canvas.addEventListener(
        "touchstart",
        function (e) {
          if (!game.paused && !gameOver) {
            e.preventDefault();
            e.stopPropagation();
            console.log("📱 TOUCH DETECTED!");
            performFlap();
          }
        },
        false
      );

      // Pointer events (for touchscreens)
      canvas.addEventListener(
        "pointerdown",
        function (e) {
          if (!game.paused && !gameOver) {
            e.preventDefault();
            e.stopPropagation();
            console.log("👆 POINTER DETECTED! Type:", e.pointerType);
            performFlap();
          }
        },
        false
      );

      // Create the trail
      this.trail = game.add.emitter(bird.x - 50, bird.y, 50);
      this.trail.makeParticles("trail");
      this.trail.setYSpeed(-20, 20);
      this.trail.setXSpeed(-20, 20);
      this.trail.setAlpha(1, 0, 1000);
      this.trail.setScale(0.5, 0, 0.5, 0, 1000);
      this.trail.start(false, 1000, 50);
    },

    update: function () {
      if (!gameOver) {
        game.physics.arcade.collide(bird, pipeGroup, die);
        if (bird.y > game.height) {
          die();
        }

        this.trail.x = bird.x - 40;
        this.trail.y = bird.y;

        if (score >= 20 && !hasShaken) {
          game.camera.shake(0.05, 500);
          hasShaken = true;
        }

        if (score > 0 && score % 10 === 0 && score !== lastLightningScore) {
          triggerLightning(game);
          lastLightningScore = score;
        }
      }
    },

    stopGame: function () {
      gameOver = true;
      game.time.events.removeAll();
      bird.body.velocity.x = 0;
      bird.body.velocity.y = 0;
      bird.body.gravity.y = 0;
      pipeGroup.forEach(function (pipe) {
        pipe.body.velocity.x = 0;
      }, this);
    },
  };

  game.state.add("Play", play);
  game.state.start("Play");

  function updateScore() {
    scoreText.text = "Score: " + score + "\nBest: " + topScore;
  }

  function loadTopScorers() {
    var storedScorers = localStorage.getItem("topFlappyScorers");
    topScorers = storedScorers ? JSON.parse(storedScorers) : [];
  }

  function updateTopScorersDisplay() {
    var displayText = "Top High Scorers\n";
    topScorers.sort((a, b) => b.score - a.score);
    for (var i = 0; i < Math.min(5, topScorers.length); i++) {
      displayText += `${i + 1}. ${topScorers[i].name}: ${
        topScorers[i].score
      }\n`;
    }
    topScorersText.text = displayText;
  }

  function checkAndAddHighScore(newScore) {
    var playerName = prompt("Enter your name:");
    if (playerName) {
      if (
        topScorers.length < 5 ||
        newScore > topScorers[topScorers.length - 1].score
      ) {
        if (topScorers.length >= 5) {
          topScorers.pop();
        }
        topScorers.push({ name: playerName, score: newScore });
        topScorers.sort((a, b) => b.score - a.score);
        localStorage.setItem("topFlappyScorers", JSON.stringify(topScorers));
        updateTopScorersDisplay();
      }
    }
  }

  function triggerLightning(game) {
    lightningElements.forEach((element) => element.remove());
    lightningElements = [];
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        let lightning = createLightningElement(game);
        lightningElements.push(lightning);
      }, i * 500);
    }
  }

  function createLightningElement(game) {
    let lightning = document.createElement("div");
    lightning.style.position = "absolute";
    lightning.style.top = "0";
    lightning.style.left = "0";
    lightning.style.width = "100%";
    lightning.style.height = "100%";
    lightning.style.pointerEvents = "none";
    lightning.style.zIndex = "1000";
    lightning.style.background = `repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 2px), linear-gradient(${
      Math.random() * 360
    }deg, rgba(173, 216, 230, 0.3), rgba(135, 206, 235, 0.5))`;

    let bolt = document.createElement("div");
    bolt.style.position = "absolute";
    bolt.style.width = "10px";
    bolt.style.height = "100%";
    bolt.style.left = `${Math.random() * 100}%`;
    bolt.style.background =
      "linear-gradient(to bottom, transparent, white, transparent)";
    bolt.style.opacity = "0.7";
    bolt.style.animation = "lightning 0.1s linear infinite";
    lightning.appendChild(bolt);

    let style = document.createElement("style");
    style.textContent = `@keyframes lightning { 0% { box-shadow: 0 0 5px white; } 50% { box-shadow: 0 0 20px white; } 100% { box-shadow: 0 0 5px white; } }`;
    document.head.appendChild(style);
    document.body.appendChild(lightning);

    setTimeout(() => {
      document.body.removeChild(lightning);
      document.head.removeChild(style);
    }, 1000);

    return lightning;
  }

  var pipeCounter = 0;

  function addPipe() {
    let currentPipeSpeed = -birdSpeed - Math.floor(score / 5) * 2;
    let currentBirdGravity = birdGravity + Math.floor(score / 10) * 20;

    if (pipeCounter === 0) {
      var pipeHolePosition = game.rnd.between(600, 200 - pipeHole);
      var upperPipe = new Pipe(
        game,
        400,
        pipeHolePosition - 620,
        currentPipeSpeed
      );
      game.add.existing(upperPipe);
      pipeGroup.add(upperPipe);
      var lowerPipe = new Pipe(
        game,
        400,
        pipeHolePosition + pipeHole + 50,
        currentPipeSpeed
      );
      game.add.existing(lowerPipe);
      pipeGroup.add(lowerPipe);
      pipeCounter++;
    } else if (pipeCounter === 1) {
      var pipeHolePosition1 = game.rnd.between(600, 200 - pipeHole);
      var upperPipe1 = new Pipe(
        game,
        500,
        pipeHolePosition1 - 620,
        currentPipeSpeed
      );
      game.add.existing(upperPipe1);
      pipeGroup.add(upperPipe1);
      var lowerPipe1 = new Pipe(
        game,
        500,
        pipeHolePosition1 + pipeHole + 50,
        currentPipeSpeed
      );
      game.add.existing(lowerPipe1);
      pipeGroup.add(lowerPipe1);

      var pipeHolePosition2 = game.rnd.between(600, 200 - pipeHole);
      var upperPipe2 = new Pipe(
        game,
        950,
        pipeHolePosition2 - 620,
        currentPipeSpeed
      );
      game.add.existing(upperPipe2);
      pipeGroup.add(upperPipe2);
      var lowerPipe2 = new Pipe(
        game,
        950,
        pipeHolePosition2 + pipeHole + 50,
        currentPipeSpeed
      );
      game.add.existing(lowerPipe2);
      pipeGroup.add(lowerPipe2);
      pipeCounter++;
    } else {
      var pipeHolePosition = game.rnd.between(600, 200 - pipeHole);
      var upperPipe = new Pipe(
        game,
        1050 + (pipeCounter - 2) * 800,
        pipeHolePosition - 620,
        currentPipeSpeed
      );
      game.add.existing(upperPipe);
      pipeGroup.add(upperPipe);
      var lowerPipe = new Pipe(
        game,
        1050 + (pipeCounter - 2) * 800,
        pipeHolePosition + pipeHole + 50,
        currentPipeSpeed
      );
      game.add.existing(lowerPipe);
      pipeGroup.add(lowerPipe);
    }

    bird.body.gravity.y = currentBirdGravity;
  }

  function die() {
    if (gameOver) return;
    gameOver = true;

    var currentTopScore = Math.max(score, topScore);
    localStorage.setItem("topFlappyScore", currentTopScore);
    checkAndAddHighScore(score);
    game.state.getCurrentState().stopGame();

    var gameOverImage = game.add.sprite(
      game.world.centerX,
      game.world.centerY,
      "gameOver"
    );
    gameOverImage.anchor.set(0.5);

    var restartButton = game.add.button(
      game.world.centerX,
      game.world.centerY + 100,
      "restartButton",
      restartGame,
      this,
      2,
      1,
      0
    );
    restartButton.anchor.set(0.5);
  }

  function restartGame() {
    location.reload();
  }

  Pipe = function (game, x, y, speed) {
    Phaser.Sprite.call(this, game, x, y, "pipe");
    game.physics.enable(this, Phaser.Physics.ARCADE);
    this.body.velocity.x = speed;
    this.giveScore = true;
  };

  Pipe.prototype = Object.create(Phaser.Sprite.prototype);
  Pipe.prototype.constructor = Pipe;

  Pipe.prototype.update = function () {
    if (this.x + this.width < bird.x && this.giveScore) {
      score += 0.5;
      updateScore();
      if (score % 1 === 0) {
        this.game.state.getCurrentState().scoreSound.play();
      }
      this.giveScore = false;
    }
    if (this.x < -this.width) {
      this.destroy();
    }
  };

  function actionOnClick() {
    console.log("🎮 START BUTTON CLICKED!");
    var currentState = game.state.getCurrentState();
    if (currentState && currentState.startSound) {
      currentState.startSound.play();
    }
    if (audioContext) {
      audioContext.resume();
    }
    setTimeout(function () {
      game.paused = false;
      button.visible = false;
      console.log("✅ GAME STARTED!");
    }, 100);
  }
};

function flap() {
  if (!gameOver && bird && bird.body) {
    bird.body.velocity.y = -birdFlapPower;
  }
}

function didntGetStream() {
  console.log("Stream generation failed.");
}

var mediaStreamSource = null;

function gotStream(stream) {
  mediaStreamSource = audioContext.createMediaStreamSource(stream);
  meter = createAudioMeter(audioContext);
  mediaStreamSource.connect(meter);
  drawLoop();
}

function drawLoop(time) {
  if (!gameOver && meter && meter.volume * 100 > 10) {
    console.log("Flapping! Volume:", meter.volume * 100);
    flap();
  }
  rafID = window.requestAnimationFrame(drawLoop);
}

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
