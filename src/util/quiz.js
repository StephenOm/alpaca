import axios from "axios";

class AnswerHandler {
  constructor(cb){
    this.game = new Game();
    this.game.start(() => {
      this._setCurrentQuestion();
      if (cb) {
        cb();
      }
    });
    this._quizOver = false;
    this.message = '';
  }

  _setCurrentQuestion(cb) {
    var question = this.game.getCurrentQuestion();
    var message = '<h1>' + question.questionString + '</h1>' +
                  '<h3>Level: ' + this.game.level + '</h3>' + '<ol>';

    question.answers.forEach(function(answer) {
      message += '<li>' + answer.answerString + '</li>';
    });

    message += '</ol>';

    this._setMessage(message, cb);
  }

  getCurrentMessage() {
    return this.message;
  }

  _setMessage(message, cb) {
    var status = document.getElementById('status');
    status.innerHTML = message;
    this.message = message;
    if (cb) {
      cb();
    }
  }

  chooseAnswer(answer) {
    if(this._quizOver === true){
      return this._chooseNextLevel(answer);
    }
    var correct = this.game.processAnswer(answer);
    if (correct === undefined) {
      return;
    }
    var nextQuestion = this.game.getNextQuestion();
    if (nextQuestion === false){
      var score = this.game.getCurrentScore();
      var message = 'Your score is ' + score + '! Choose 1 to redo the quiz, choose 2 to start a different quiz.';
      this._setMessage(message);
      this._quizOver = true;
    } else {
      this._setCurrentQuestion();
    }
    return correct;
  }

  _chooseNextLevel(response) {
    console.log('_chooseNextLevel works');
    if (response == '1') {
      // start the game over again at the same level
      this._quizOver = false;
      this.game.finishLevel(false, function() {
        this._setCurrentQuestion();
      }.bind(this));
    } else if (response == '2') {
      // go to the next level
      this._quizOver = false;
      this.game.finishLevel(true, function() {
        this._setCurrentQuestion();
      }.bind(this));
    }
  }

}

class Game {
  constructor() {
    // Levels correspond to quiz ids. If you complete a level at 100%, you pass on to the next one.
    this.level = 1;
    this._currentQuiz;
    this._currentQuestionIndex = 0;
    // Number of wrong answers during the current quiz
    this._numCorrectAnswers = 0;
    this._numWrongAnswers = 0;
    // Set in _initializeCurrentQuiz
    this._numLevels;
  }

  /**
   * Starts the game for the current level.
   *
   * @var Function
   *   Callback that will be run when questions are set.
   */
  start(cb) {
    this._initializeCurrentLevel(cb);
  }

  /**
   * Initializes the current game.
   */
  _initializeCurrentLevel(cb) {
    // @todo
    this._initializeCurrentQuiz(this.level, cb);
    // Number of correct answers during the current quiz
    this._numCorrectAnswers = 0;
    // Number of wrong answers during the current quiz
    this._numWrongAnswers = 0;
  }

  /**
   * Gets the question that the player is about to answer.
   */
  getCurrentQuestion() {
    return this._currentQuiz.questions[this._currentQuestionIndex];
  }

  /**
   * Checks the answer given by the player and sets the next question if applicable.
   *
   * @val string answer
   *   The answer ID given by the player (1, 2, 3, or 4).
   *
   * @return bool|undefined
   *   true if correct, false if incorrect, undefined if no such answer.
   */
  processAnswer(answerId) {
    if (!this.getCurrentQuestion().hasAnswerId(answerId)) {
      console.log('answer not found');
      return undefined;
    }

    let match = answerId.toString() === this.getCurrentQuestion().correctAnswerId.toString();
    if (match) {
      this._numCorrectAnswers++;
      console.log('correct answer')
    } else {
      this._numWrongAnswers++;
      console.log('wrong answer');
    }
    return match;
  }

  /**
   * Gets the quiz data that corresponds to the current level.
   */
  _initializeCurrentQuiz(level, cb) {
    this._currentQuestionIndex = 0;
    // make every testName correspond to a quiz ID.
    var testNames = [];
    var testNameForLevel;
    var questions = [];
    axios.get('http://localhost:1337/questions')
      .then(response => {
        var entries = response.data;
        entries.forEach(entry => {
          if (testNames.indexOf(entry.testName) === -1) {
            testNames.push(entry.testName);
          }
          if (this.level === testNames.length) {
            testNameForLevel = entry.testName;
          }
          if (entry.testName === testNameForLevel) {
            questions.push(new Question(entry.name, entry.correct, entry.wrong1, entry.wrong2, entry.wrong3));
          }
        });
        this._currentQuiz = new Quiz(testNameForLevel, questions);
        this._numLevels = testNames.length;
        if (cb) {
          cb.bind(this)();
        }
      })
      .catch(function(err){
        console.log(err)
      })
  }

  /**
   * Gets the next question and checks if all questions have been answered.
   *
   * Returns false if there is no next question.
   *
   * @return bool|string
   */
  getNextQuestion() {
    this._currentQuestionIndex++;
    var question = this._currentQuiz.questions[this._currentQuestionIndex];
    if (question === undefined) {
      return false;
    }
    return question;
  }

  getCurrentScore() {
    if (!this._currentQuiz || this._currentQuiz.questions.length === 0) {
      return '0%';
    }
    return Math.floor(this._numCorrectAnswers / this._currentQuiz.questions.length * 100) + '%';
  }

  /**
   * Passes the game on to the next level and initializes it.
   *
   * @return Function cb
   *   Called when the questions are initialized.
   */
  finishLevel(nextLevel, cb) {
    if (nextLevel) {
      if (this.level + 1 > this._numLevels) {
        this.level = 1;
      } else {
        this.level++;
      }
    }
    this._initializeCurrentLevel(cb);
  }
};


/**
 * Quiz class
 */
class Quiz {

  /**
   * @var string quizName
   * @var Question[] questions
   */
  constructor(quizName = '', questions) {
    this.quizName = quizName;
    questions.forEach((question) => {
      if (!question instanceof Question) {
        throw new Error('invalid question');
      }
    });
    this.questions = questions;
  }

  addQuestion(question) {
    if (!question instanceof Question) {
      throw new Error('invalid question');
    }
    this.questions.push(question);
  }
};

class Question {
  constructor(questionString = '', correctAnswer = '', wrong1 = '', wrong2 = '', wrong3 = '') {
    this.questionString = questionString;
    this.answers = [];
    this.answers.push(new Answer(correctAnswer, true));
    this.answers.push(new Answer(wrong1, false));
    this.answers.push(new Answer(wrong2, false));
    this.answers.push(new Answer(wrong3, false));
    // Remove blank answers.
    this.answers = this.answers.filter(function(answer) {
      return !!answer.answerString;
    });
    // Shuffle the answers.
    this._shuffle(this.answers);
    // Add an answer ID.
    this.answers.map((answer, i) => answer.answerId = i + 1);
    // Set the answerId property.
    this._setCorrectAnswerId();
  }

  hasAnswerId(answerId) {
    for (var i = 0; i < this.answers.length; i++) {
      if (this.answers[i].answerId == answerId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sets the correctAnswerId property. This assumes there is only one correct answer.
   */
  _setCorrectAnswerId() {
    for (let i = 0; i < this.answers.length; i++) {
      if (this.answers[i].isCorrect) {
        this.correctAnswerId = this.answers[i].answerId;
      }
    }
  }

  _shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }
};

/**
 * Answer class
 */
class Answer {
  constructor(answerString, isCorrect) {
    this.answerString = answerString;
    this.isCorrect = isCorrect;
  }
}

module.exports = {
  Game: Game,
  Question: Question,
  Answer: Answer,
  AnswerHandler: AnswerHandler
};

window.AnswerHandler = AnswerHandler;
