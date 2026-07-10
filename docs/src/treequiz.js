// QUESTION FILE CONSTANTS
// THESE VALUES TELL THE CODE WHICH COLUMNS ARE WHICH. 
// DO NOT CHANGE UNLESS THE STRUCTURE OF THE CSV CHANGES.
const ID_COLUMN_INDEX = 0;
const TREE_NAME_COLUMN_INDEX = 1;
const TREE_ALTERNATE_NAMES_COLUMN_INDEX = 2;
const DATA_SHEET_COLUMN_INDEX = 3;
const FIRST_QUESTION_COLUMN_INDEX = 4;

// TODO: Make this dynamic based on which CSV file we loaded
const FIRST_SEASONAL_QUESTION_COLUMN_INDEX = 10; 

// HOW MANY INCORRECT CHOICES SHOULD BE SHOWN WITH EACH QUESTION? 
const MAX_INCORRECT_ANSWERS = 3;

// PHOTO FILE CONSTANTS
const PHOTO_TREE_ID_COLUMN_INDEX = 0;
const PHOTO_IMAGE_COLUMN_INDEX = 1;
const PHOTO_IMAGE_START_DATE_COLUMN_INDEX = 2;

// RELATIVE ROOT URL FOR THIS PROJECT. ONLY CHANGE IF THE CODE IS DEPLOYED TO A NEW HOST
const baseURL = '/tree-quiz';

let defaultTranslation = {};
let translation = {};
let questionList = {};
let photoList = [];


function init(){
  const queryParams = new URLSearchParams(location.search);
  const loadingElement = document.getElementById('loading');

  let translationRequest;
  if(queryParams.lang) {
    translationRequest = loadLanguage(queryParams.lang);
  }

  const defaultTranslationRequest = loadLanguage();
  const questionRequest = loadQuestionSet(queryParams.get('type'));
  const photoRequest = loadPhotoList(queryParams.get('id'));

  const allRequests = [
    translationRequest,
    defaultTranslationRequest,
    questionRequest,
    photoRequest,
  ].filter(function(obj){ return obj || false });

  Promise.all(allRequests).then(() => {
    populateLanguageSelect();
    applyTranslation();
    generateQuestionHTML();
    loadingElement.classList.add('complete');
  });

}

function loadLanguage(lang){
  if(!lang){
    lang = 'default';
  }
  lang = cleanURLParams(lang);

  return fetch(`${baseURL}/data/language.${lang === 'en' ? 'default' : lang}.csv`)
    .then(function(resp){ return resp.text() })
    .then(parseLanguageCSV)
    .then(function(language){ 
      for(let key in language){
        saveTranslationKey(key, language[key], lang);
      }
      return language;
    });
}

function setUserLang(lang) {
  window.localStorage.setItem('language', lang);
  loadLanguage(lang).then(applyTranslation);
}
function getUserLang() {
  return window.localStorage.getItem('language') || 'default';
}
function clearUserLang() {
  window.localStorage.removeItem('language');
}

function parseLanguageCSV(responseText) {
  const languageObj = {};

  const languageArray=responseText.split('\n');

  // Assume the first row is data headers that we do not need
  // Assume file format is [key],[value]
  for(let i=1; i<languageArray.length; i++) {
    const row = languageArray[i];
    if(!row.trim()) { continue; }
    const rowArr = row.split(',');
    const value = rowArr.splice(1).join(',');
    const key = rowArr[0].trim();

    // Skip instructional rows
    if(key.includes(' ') || key.indexOf('*')===0) { continue; }

    languageObj[key] = value;
  }
  return languageObj;
}

function applyTranslation() {
  const elementsToTranslate = document.querySelectorAll('[data-language-key]');
  for(let i=0; i<elementsToTranslate.length; i++){
    const el = elementsToTranslate[i];
    const languageKey = el.dataset.languageKey;
    el.innerText = translation[languageKey] || defaultTranslation[languageKey] || '';
    el.innerHTML = el.innerText.replace(/\n/gi, '<br />');
  }
}

function loadQuestionSet(type) {
  if(!type) {
    throw 'Cannot load questionnaire if no type is set!'
  }

  type = cleanURLParams(type);
  return fetch(`${baseURL}/data/${type}.csv`)
    .then(function(resp){ return resp.text() })
    .then(processQuestionCSV)
    .then(function(data){ 
      questionList = data;
      return data;
    });
}

function loadQuestionTranslations(type){
  const lang = getUserLang();
  // TODO;
}

function loadPhotoList(treeID){
  return fetch(`${baseURL}/data/photos.csv`)
    .then(function(resp){ return resp.text() })
    .then(function(responseText) {
      return parsePhotoList(responseText, treeID);
    })
    .then(function(data){ 
      photoList = data;
      return data;
    });
}

function parsePhotoList(responseText, treeID) {
  treeID = cleanURLParams(treeID);
  const photoArr = [];
  const rows = responseText.split('\n');

  // Assume the first row is header information that we do not need
  for(let r=1; r<rows.length; r++) {
    const row = rows[r];
    // Skip empty rows
    if(!row) { continue; }

    const rowArr = row.split(',');

    // Skip if the photo doesn't belong to the current tree
    if(rowArr[PHOTO_TREE_ID_COLUMN_INDEX].toLowerCase() != treeID) {
      continue;
    }
    photoArr.push(formatPhotoRow(rowArr));
  }
  return photoArr;
}

function formatPhotoRow(csvRow) {
  const now = new Date();
  const currentYear = now.getFullYear();

  let startDate = new Date(`${currentYear}-${csvRow[PHOTO_IMAGE_START_DATE_COLUMN_INDEX]}`);
  if(startDate === 'Invalid Date') {
    startDate = new Date(`${currentYear}-01-01T00:00-06:00`);
  }
  if(startDate > now) {
    startDate = subtractOneYear(startDate);
  }
  return {
    treeID: csvRow[PHOTO_TREE_ID_COLUMN_INDEX],
    url: csvRow[PHOTO_IMAGE_COLUMN_INDEX],
    start: startDate,
  }
}

function subtractOneYear(date) {
  return new Date(`${date.getFullYear()-1}-${parseInt((date.getMonth()+1)/10)}${(date.getMonth()+1)%10}-${parseInt(date.getDate()/10)}${date.getDate()%10}T${parseInt(date.getHours()/10)}${date.getHours()%10}:${parseInt(date.getMinutes()/10)}${date.getMinutes()%10}-${parseInt(date.getTimezoneOffset()/600)}${parseInt(date.getTimezoneOffset()/60)%10}:00`)
}

function cleanURLParams(text) {
  return text.replace(/\W/gi, '').toLowerCase();
}

function processQuestionCSV(dataStr, treeID) {
  const dataStructure = {
    treeID: treeID, 
    dataLines: [], 
    questions: [], 
    name: null, 
    synonyms: [], 
    mainImage: null, 
    dataSheetURL: null 
  };
  const dataArr = dataStr.split('\n').reduce(processQuestionCSVLine, dataStructure);
  
  for(let i=0; i<dataArr.questions.length; i++) {
    const question = dataArr.questions[i];
    question.incorrectAnswers = question.incorrectAnswers.filter( wrongAnswer => (wrongAnswer.text && wrongAnswer.text.toLowerCase() !== (question.correctAnswer || '').toLowerCase()));

    for(let a=0; a<question.incorrectAnswers.length; a++) {
      defaultTranslation[`incorrect_answer_${i}_${a}`] = question.incorrectAnswers[a].text;
    }
  }
  return dataArr;
}

function processQuestionCSVLine(arr, line, index){
  if(!line) {
    return arr;
  }

  const queryParams = new URLSearchParams(location.search);
  const treeID = (queryParams.get('id') || '').trim();
  if(!treeID) {
    console.error('NO TREE ID PROVIDED!')
  }
  parsedLine = line.split(',');
  parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX] = generateSynonyms(parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX]);
  arr.dataLines.push(parsedLine);

  let questionIndex = 0;
  // We expect all question columns to come in pairs (question + image)
  for(let i=FIRST_QUESTION_COLUMN_INDEX; i<parsedLine.length; i+=2) {
    if(index === 0) {
      // First row. Set up all the questions using the column headers.
      const questionData = { 
        prompt: parsedLine[i], 
        correctAnswer: null, 
        image: '', 
        incorrectAnswers: [], 
        isSeasonal: i>= FIRST_SEASONAL_QUESTION_COLUMN_INDEX,
        index: questionIndex,
      };
      arr.questions.push(questionData);
      defaultTranslation['question_prompt_' + questionIndex] = questionData.prompt;
    }
    else if(parsedLine[ID_COLUMN_INDEX] === treeID) {
      // Correct tree. Add the current answers as correct answers
      arr.questions[questionIndex].correctAnswer = parsedLine[i];
      arr.questions[questionIndex].image = parsedLine[i+1];
      arr.name = parsedLine[TREE_NAME_COLUMN_INDEX];
      arr.synonyms = parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX];
      arr.dataSheetURL = parsedLine[DATA_SHEET_COLUMN_INDEX];

      defaultTranslation.tree_name = parsedLine[TREE_NAME_COLUMN_INDEX];
      defaultTranslation.tree_synonyms = generateSynonymText(parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX], true);
      defaultTranslation['correct_answer_' + questionIndex] = arr.questions[questionIndex].correctAnswer;
    }
    else if(arr.questions[questionIndex]) {
      // Not the current tree. If we have answers and images, add them to the incorrect answer list
      const question = arr.questions[questionIndex];
      const existingAnswerIndex = question.incorrectAnswers.findIndex( (answer) => answer.text.toLowerCase().trim() === parsedLine[i].toLowerCase().trim() );
      if(existingAnswerIndex > -1) { 
        // If this is a repeat answer, just save the image if we have one
        if(parsedLine[i+1]) {
          question.incorrectAnswers[existingAnswerIndex].images.push(parsedLine[i+1]);
        }
      }
      else {
        const answerText = parsedLine[i].trim();
        question.incorrectAnswers.push({text: answerText, images: [parsedLine[i+1]]});
      }
    }
    questionIndex ++;
  }

  return arr;
}

function generateSynonyms(data) {
  let synonyms = data.split(/[\\\|\/]/gi)
  for(let i=0; i<synonyms.length; i++) {
    synonyms[i] = synonyms[i].trim();
  }
  return synonyms;
}
function generateSynonymText(synonymArr, defaultLanguage) {
  if(!synonymArr.length) {
    return '';
  }
  else if(synonymArr.length === 1) {
    return synonymArr[0];
  }
  const firstEntries = synonymArr.slice(0, synonymArr.length - 1);
  const finalEntry = synonymArr.slice(-1);

  let translationToUse = defaultLanguage ? defaultTranslation : translation;
  let listJoiner = `${translationToUse.answer_synonym_joiner || ','} `;
  let finalJoiner = ` ${translationToUse.answer_final_synonym_joiner || 'and'} `;
  
  return `${firstEntries.join(listJoiner)}${finalJoiner}${finalEntry}`;
}

function populateLanguageSelect(){
  const languageSelectEl = document.getElementById('language-select');
  if(!languageSelectEl) {
    console.error('COULD NOT FIND LANGUAGE SELECT ELEMENT');
    return;
  }
  // We have already populated the element, don't do it a second time
  if(languageSelectEl.children.length > 1) {
    return;
  }
  // Find all the languages defined via the translation keys
  for(let key in defaultTranslation) {
    if(key.indexOf('language_choice_') !== 0) { continue; }
    
    const languageOption = document.createElement('option');
    languageOption.dataset.languageKey = key;
    languageOption.value = key.replace('language_choice_', '');
    languageSelectEl.appendChild(languageOption);
  }
  languageSelectEl.addEventListener('change', onLanguageSelect);
  languageSelectEl.value = getUserLang();
}

function onLanguageSelect(evt){
  const languageSelectEl = evt.target;
  const lang = languageSelectEl.value;
  setUserLang(lang);
}

function generateQuestionHTML() {
  const questionWrapper = document.getElementById('quiz_main');
  if(!questionWrapper) {
    console.error('COULD NOT FIND QUIZ WRAPPER!');
    return;
  }

  for(let i=0; i<questionList.questions.length; i++) {
    const question = questionList.questions[i];

    if (question.isSeasonal) {
      questionHTML = generateSeasonalQuestionHTML(question, questionWrapper);
    }
    else {
      questionHTML = generateMainQuestionHTML(question, questionWrapper);
    }    
  }
}

function generateSeasonalQuestionHTML(question, questionWrapper) {
  if(!question.prompt || !question.correctAnswer) {
    return null;
  }
  const answers = generateMultipleChoice(question);
  const questionElement = document.createElement('div');
  questionElement.className = 'question seasonal';

  const headingElement = document.createElement('h3');
  headingElement.className = 'question_heading';
  headingElement.dataset.languageKey = `question_prompt_${question.index}`
  questionElement.appendChild(headingElement);

  const answersDiv = document.createElement('div');
  answersDiv.className = 'answers_wrapper seasonal_answers';

  for(let i=0; i<answers.length; i++) {
    const answerObj = answers[i];
    const answerEl = document.createElement('button');
    answerEl.type = 'button';
    answerEl.className = 'answer seasonal';
    answerEl.addEventListener('click', answerObj.onSelect);

    const answerImg = document.createElement('img');
    answerImg.className = 'answer_img seasonal_img';
    answerImg.src = baseURL + '/images/' + answerObj.image;
    answerEl.appendChild(answerImg);

    const answerText = document.createElement('span');
    answerText.className = 'answer_text seasonal_answer_text';
    answerText.dataset.languageKey = answerObj.languageKey;
    answerEl.appendChild(answerText);

    answersDiv.appendChild(answerEl);
  }

  console.log('APPENDING:', questionElement, question)
  questionWrapper.appendChild(questionElement);
  return questionElement;
}

function generateMainQuestionHTML(question, questionWrapper) {
  if(!question.prompt || !question.correctAnswer) {
    return null;
  }
  const answers = generateMultipleChoice(question);
  const questionElement = document.createElement('div');
  questionElement.className = 'question seasonal';

  const headingElement = document.createElement('h3');
  headingElement.className = 'question_heading';
  headingElement.dataset.languageKey = `question_prompt_${question.index}`
  questionElement.appendChild(headingElement);

  const questionImg = document.createElement('img');
  questionImg.className = 'question_img';
  questionImg.src =  baseURL + '/images/' + question.image;
  questionElement.appendChild(questionImg);

  const answersDiv = document.createElement('div');
  answersDiv.className = 'answers_wrapper';

  for(let i=0; i<answers.length; i++) {
    const answerObj = answers[i];
    const answerEl = document.createElement('button');
    answerEl.type = 'button';
    answerEl.className = 'answer';
    answerEl.addEventListener('click', answerObj.onSelect);

    const answerText = document.createElement('span');
    answerText.className = 'answer_text';
    answerText.dataset.languageKey = answerObj.languageKey;
    answerEl.appendChild(answerText);

    answersDiv.appendChild(answerEl);
  }

  console.log('APPENDING:', questionElement, question)
  questionWrapper.appendChild(questionElement);
  return questionElement;
}

function saveTranslationKey(key, value, lang){
  // If CSV cell was wrapped with quotation marks (so that literal commas could be entered, for example), remove those
  if(value[0] === '"' && value[value.length-1] === '"') {
    value = value.slice(1, -1);
  }

  if(!lang || lang==='default' || lang==='en') {
    defaultTranslation[key] = value;
  }
  else {
    translation[key] === value;
  }
}

function generateMultipleChoice(question) {
  const answersArr = [];
  answersArr.push({
    languageKey: `correct_answer_${question.index}`,
    position: Math.random(),
    onSelect: onCorrectAnswerSelected,
    image: question.image,
  });

  // Prepare all of our wrong answer objects
  let incorrectCandidates = question.incorrectAnswers.map(function(answer, index){
    return {
      languageKey: `incorrect_answer_${question.index}_${index}`,
      position: Math.random(),
      onSelect: onIncorretAnswerSelected,
      image: answer.image,
    }
  });

  // Sort the incorrect answers and take up to the MAX_INCORRECT_ANSWERS
  incorrectCandidates = incorrectCandidates.sort(function(a1, a2){
    return a1.position - a2.position;
  });
  for(let i=0; i<incorrectCandidates.length && i<MAX_INCORRECT_ANSWERS; i++){
    answersArr.push(incorrectCandidates[i]);
  }

  // Sort the correct answer into the mix as well
  return answersArr.sort(function(a1, a2){
    return a1.position - a2.position;
  });
}

function onCorrectAnswerSelected(evt) {}
function onIncorretAnswerSelected(evt) {}

function goToQuizPage(evt) {}
function goToIntroPage(evt) {}
function goToIntroOrQuiz(evt) {
  const today = new Date();
  const lastVisit = new Date(localStorage.getItem('last_visit') || '2000-01-01');

  if(lastVisit.getFullYear() === today.getFullYear() && lastVisit.getMonth() === today.getMonth() && lastVisit.getDate() === today.getDate() ) {
    return goToQuizPage(evt);
  }
  return goToIntroPage(evt);
}
function goToSeasonalSelection(evt){}

init();