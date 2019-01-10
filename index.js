const streamDeckApi = require('stream-deck-api');
const DcsBiosApi = require('dcs-bios-api');
const path = require('path');
const robot = require('robotjs');

const IMAGE_FOLDER = './images/';

var api = new DcsBiosApi({ logLevel: 'INFO' });
var streamDeck = streamDeckApi.getStreamDeck();
api.startListening();

process.on('SIGINT', () => {
  streamDeck.reset();
  streamDeck.close();
  api.stopListening();
  process.exit();
});

streamDeck.reset();

var pages = {
  MAIN: {
    1: {
      view: { type: 'stateImage', input: 'ANTI_SKID_SWITCH', states: { '0': 'AP_B_off.png', '1': 'AP_B_on.png' }},
      action: { type: 'cycle_state', output: 'ANTI_SKID_SWITCH', values: ['0', '1'] }
    },
    2: {
      view: { type: 'label', text: 'AAP'},
      action: { type: 'page', page: 'AAP' }
    },
    5: {
      view: { type: 'stateImage', input: 'MASTER_CAUTION', states: { '0': 'AP_B_off.png', '1': 'AP_B_on.png' }},
      action: { type: 'push_button', output: 'UFC_MASTER_CAUTION' }
    },
  },
  AAP: {
    1: {
      view: { type: 'label', text: '111'},
    },
    3: {
      view: { type: 'label', text: 'MAIN'},
      action: { type: 'page', page: 'MAIN' }
    },
  },
};

var initializeViewFn = {
}

var initializeActionFn = {
}

initializeViewFn['stateImage'] = function(view, key) {
  // Draw the new image when the LED state changes.
  api.on(view.input, (currentValue) => {
    view.currentImage = path.resolve(IMAGE_FOLDER + view.states[currentValue]);
    draw(view);
  });
}

initializeViewFn['label'] = function(view, key) {
  // Draw a static label
  streamDeck.drawText(view.text, view.number, { x: 6, fontFile: './fonts/consolas-24-white/consolas-24-white.fnt', bufferOnly: true }).then((buffer) => {
    view.currentImageBuffer = buffer;
    draw(view);
  });
}

initializeActionFn['cycle_state'] = function(action, key) {
  streamDeck.on(`up:${action.number}`, () => {
    let currentValue = api.getControlValue(action.output).toString() 
    let currentValueIndex = action.values.indexOf(currentValue)
    let newValueIndex = (1 + currentValueIndex ) % action.values.length 
    let newValue = action.values[newValueIndex]
    api.sendMessage(`${action.output} ${newValue}\n`);
  });
  
}

initializeActionFn['push_button'] = function(action, key) {
  streamDeck.on(`down:${action.number}`, () => {
    api.sendMessage(`${action.output} 1\n`);
  });
  streamDeck.on(`up:${action.number}`, () => {
    api.sendMessage(`${action.output} 0\n`);
  });
  
}

initializeActionFn['page'] = function(action, key) {
  streamDeck.on(`up:${action.number}`, () => {
    displayPage(action.page);
  });
}

initializePages(pages);

function initializePages(pages) {
  Object.keys(pages).forEach((pageName) => {
    var page = pages[pageName];

    for (let i = 1; i <= 15; i++) {
      page[i] = page[i] || {};

      var key = page[i];
      key._page = pageName;
      key.number = i;
      initializeView(key);
    }
  });
}

function initializeView(key) {
  if (key.view) {
    key.view.number = key.number
    key.view._page = key._page
    initializeViewFn[key.view.type](key.view, key)
  } else {
    key.view = {}
    key.view.number = key.number
    key.view._page = key._page
    draw(key.view)
  }
}

function initializeAction(key) {
  if (key.action) {
    key.action.number = key.number
    initializeActionFn[key.action.type](key.action, key)
  }
}


var currentPage;
displayPage('MAIN');

function displayPage(pageName) {
  streamDeck.removeButtonListeners();
  currentPage = pageName;
  var page = pages[pageName];

  Object.keys(page).forEach((keyNumber) => {
    var key = page[keyNumber];
    initializeAction(key);
    draw(key.view);
  });
}

function draw(view) {
  
  if (currentPage != view._page) { return; }

  if (view.currentImageBuffer) {
    streamDeck.drawImageBuffer(view.currentImageBuffer, view.number);
  }
  else if (view.currentImage) {
    streamDeck.drawImageFile(view.currentImage, view.number);
  }
  else {
    streamDeck.drawColor(0x000000, view.number);
  }
}

function addKeyListener(key) {
  /*
  key.type.forEach((type) => {
    if (type == 'ledButton') {
      streamDeck.on(`down:${key.number}`, () => {
        api.sendMessage(`${key.button} 1\n`);
      });

      streamDeck.on(`up:${key.number}`, () => {
        api.sendMessage(`${key.button} 0\n`);
      });
    }
    else if (type == 'button') {
      var upImagePath = path.resolve(IMAGE_FOLDER + key.upImage);
      var downImagePath = path.resolve(IMAGE_FOLDER + key.downImage);

      streamDeck.on(`down:${key.number}`, () => {
        api.sendMessage(`${key.button} 1\n`);
        key.currentImage = downImagePath;
        draw(key);
      });

      streamDeck.on(`up:${key.number}`, () => {
        api.sendMessage(`${key.button} 0\n`);
        key.currentImage = upImagePath;
        draw(key);
      });
    }
    else if (type == 'keyboard') {
      streamDeck.on(`down:${key.number}`, () => {
        pressKeyboard(key.keys);
      });
    }
    else if (type == 'page') {
      streamDeck.on(`down:${key.number}`, () => {
        displayPage(key.page);
      });
    }
    else if (key.type == 'stateButton') {
      var upImagePath = path.resolve(IMAGE_FOLDER + key.upImage);
      var downImagePath = path.resolve(IMAGE_FOLDER + key.downImage);
  
      streamDeck.on(`down:${key.number}`, () => {
        if (key.state == 1) {
          key.state = 0;
          api.sendMessage(`${key.button} 0\n`);
          key.currentImage = upImagePath;
          draw(key);
        } else {
          key.state = 1;
          api.sendMessage(`${key.button} 1\n`);
          key.currentImage = downImagePath;
          draw(key);
        }
      });
    }
    else if (key.type == 'toggleButton') {
      var upImagePath = path.resolve(IMAGE_FOLDER + key.upImage);
      var downImagePath = path.resolve(IMAGE_FOLDER + key.downImage);
  
      streamDeck.on(`down:${key.number}`, () => {
        api.sendMessage(`${key.button} INC\n`);
      })
    }    
  });
  */
}

/**
 * Create a button that navigates to another page.
 */
function createPageButton(key) {
  if (key.image) {
    var imagePath = path.join(IMAGE_FOLDER, key.image);
    key.currentImage = imagePath;
    draw(key);
  }
  else if (key.text) {
    streamDeck.drawText(key.text, key.number, { x: 6, fontFile: './fonts/consolas-24-white/consolas-24-white.fnt', bufferOnly: true }).then((buffer) => {
      key.currentImageBuffer = buffer;
      draw(key);
    });
  }
}


function pressKeyboard(keyboardKeys) {
  keyboardKeys = Array.isArray(keyboardKeys) ? keyboardKeys : [keyboardKeys];

  keyboardKeys.forEach((key) => {
    if (key.includes('+')) {
      var split = key.split('+');
      var modifier = split[0];
      var character = split[1];

      console.log('pressing combo key', modifier, character);
      robot.keyToggle(modifier, 'down');
      robot.keyToggle(character, 'down');
      robot.keyToggle(character, 'up');
      robot.keyToggle(modifier, 'up');
    }
    else {
      console.log('pressing single key', key);
      robot.keyTap(key);
    }
  });
}
