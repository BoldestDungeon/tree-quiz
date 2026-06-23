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

  Promise.all(allRequests).then(loadingElement.classList.add('complete'));

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

function parseLanguageCSV(responseText) {
  const languageObj = {};

  const languageArray=responseText.split('\n');

  // Assume the first row is data headers that we do not need
  // Assume file format is [key],[value]
  for(let i=1; i<languageArray.length; i++) {
    const row = languageArray[i];
    if(!row.trim()) { continue; }
    const rowArr = row.split(',');
    const key = rowArr.splice(1);
    const value = (rowArr.join(',') || '').trim();
    languageObj[key[0].trim()] = value;
  }
  return languageObj;
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

function parseQuestionCSV(responseText) {
  return responseText;
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
  const currentYear = new Date().getFullYear();
  let startDate = new Date(`${currentYear}-${csvRow[PHOTO_IMAGE_START_DATE_COLUMN_INDEX]}`);
  if(startDate === 'Invalid Date') {
    startDate = new Date(`${currentYear}-01-01`);
  }
}

function cleanURLParams(text) {
  return text.replace(/\W/gi, '').toLowerCase();
}



init();