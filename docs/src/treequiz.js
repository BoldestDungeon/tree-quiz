// QUESTION FILE CONSTANTS
// THESE VALUES TELL THE CODE WHICH COLUMNS ARE WHICH. 
// DO NOT CHANGE UNLESS THE STRUCTURE OF THE CSV CHANGES.
const ID_COLUMN_INDEX = 0;
const TREE_NAME_COLUMN_INDEX = 1;
const TREE_ALTERNATE_NAMES_COLUMN_INDEX = 2;
const DATA_SHEET_COLUMN_INDEX = 3;
const FIRST_QUESTION_COLUMN_INDEX = 4;
const FIRST_SEASONAL_QUESTION_COLUMN_INDEX = {deciduous: 10, coniferous: 8, default: 10};

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
    applyTranslation();
    loadingElement.classList.add('complete');
  });

}

function loadLanguage(lang){
  if(!lang){
    lang = 'default';
  }
  lang = cleanURLParams(lang);

  return fetch(`${baseURL}/data/language.${lang}.csv`)
    .then(function(resp){ return resp.text() })
    .then(parseLanguageCSV)
    .then(function(language){ 
      if(lang == 'default'){
        defaultTranslation = language 
      }
      else {
        translation = language;
      }
      return language;
    });
}

function setUserLang(lang) {
  window.localStorage.setItem('language', lang);
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
  }
}

function loadQuestionSet(type) {
  if(!type) {
    throw 'Cannot load questionnaire if no type is set!'
  }

  type = cleanURLParams(type);
  return fetch(`${baseURL}/data/${type}.csv`)
    .then(function(resp){ return resp.text() })
    .then(parseQuestionCSV)
    .then(function(data){ 
      questionList = data;
      return data;
    });
}

function loadQuestionTranslations(type){
  const lang = getUserLang();
  // TODO;
}

function parseQuestionCSV(responseText) {
  return processQuestionCSV(responseText);
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
  }
  return dataArr;
}

function processQuestionCSVLine(arr, line, index){
  if(!line) {
    return arr;
  }
  const treeID = arr.treeID;
  parsedLine = line.split(',');
  parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX] = generateSynonyms(parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX]);
  arr.dataLines.push(parsedLine);

  let questionIndex = 0;
  // We expect all question columns to come in pairs (question + image)
  for(let i=FIRST_QUESTION_COLUMN_INDEX; i<parsedLine.length; i+=2) {
    if(index === 0) {
      // First row. Set up all the questions using the column headers.
      arr.questions.push({ prompt: parsedLine[i], correctAnswer: null, image: '', incorrectAnswers: []});
    }
    else if(parsedLine[ID_COLUMN_INDEX] === treeID) {
      // Correct tree. Add the current answers as correct answers
      arr.questions[questionIndex].correctAnswer = parsedLine[i];
      arr.questions[questionIndex].image = parsedLine[i+1];
      arr.name = parsedLine[TREE_NAME_COLUMN_INDEX];
      arr.synonyms = parsedLine[TREE_ALTERNATE_NAMES_COLUMN_INDEX];
      arr.dataSheetURL = parsedLine[DATA_SHEET_COLUMN_INDEX];
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
        question.incorrectAnswers.push({text: parsedLine[i].trim(), images: [parsedLine[i+1]]});
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

init();