const baseURL = '/tree-quiz';

function init(){}

function loadLanguage(lang){
  if(!lang){
    lang = 'default';
  }

  fetch(`${baseURL}/data/language.${lang}.csv`)
    .then(function(resp){ return resp.text() })
    .then(parseLanguageCSV)
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
    const key = rowArr.splice(1)[0].trim();
    const value = (rowArr.join(',') || '').trim();
    languageObj[key] = value;
  }
  return languageObj;
}