import * as fs from 'fs';
import * as marked from 'marked';
import fm from 'front-matter';
import {stemmer} from 'stemmer'

const pathStart = "../dcs-notes.github.io";
//const pathStart = ".";
const excludeFildersNamed=[".jekyll-cache","_site",".github","node_modules"];

const excludeFilesNamed=["README.md","CONTRIBUTING.md"];



//scores
const tokenScores=
{

    "code":-1,
    "codespan":-1,
    "space":-1,
    "image":-1,
    "html":-1,
    "escape":-1,
    "hr":-1,
    "br":-1,
    

    "heading":3, //has a special case 20- 6*heading
    "tableHeader":4, //
    "tableBody":2,

    "text":0,
    "paragraph":1,
    "list":3,
    "list_item":0,
    "em":5,
    "strong":5,
    "link":2,
    "blockquote":2,
    "table":2,
}
const titleScore =50;
const descriptionScore =20;
const modulePath=100;

const MaxSafe=1;
const MaxWordlength=15;
const MinWordLenght=1;

var baseWords=new Set();

var data= fs.readFileSync("common.txt",{encoding:'utf-8'});
var commonwords = data.split("\n");


function getFiles(dir,excempt){
    var results=[]

    var files=fs.readdirSync(dir);
    files.forEach(file => {
        var path = dir+'/'+file;
        if (file.endsWith(".md") && !excludeFilesNamed.includes(file)){
            results.push(path);
        }
        if (fs.statSync(path).isDirectory() && !excludeFildersNamed.includes(file)){
            results=results.concat(getFiles(path));
        }
    });
    return results;
}


function Score(wordString, scoreArray,wordScore){
    
    //remove any whitespace, html tags numbers and punctuation
    wordString = wordString.replace(/[\t\n] | <[^>]*>/g," ");
    wordString = wordString.replace(/\n/g," ");
    wordString = wordString.replace(/[^a-zA-Z0-9 ]/g," ");
    //split on space
    var words= wordString.split(" ");
    
    for (var word of words) {
        word=word.toLowerCase();

        if (word!=" " && word!="" && word.length>= MinWordLenght && word.length <= MaxWordlength && !commonwords.includes(word)){
            var stemmed=stemmer(word);
            if (scoreArray.get(stemmed)){
                scoreArray.set(stemmed,(scoreArray.get(stemmed)+wordScore));
            }else{
                scoreArray.set(stemmed,wordScore);
                baseWords.add(word);
            }
            
            
        }
    }
}

function analyseTokens(tokens,score,weight){
    for (const token of tokens) {
        var tempweight=weight;
        //cusotm weighting 
        if (token.type && !(token.type in tokenScores)){
            continue;
        }
        if (tokenScores[token.type] ==-1){
            continue;
        }

        //cusotm weight adjustment
        if (token.type == 'heading' ){
            tempweight=tempweight+20-tokenScores[token.type]*token.depth;
        }else if (token.type == 'table' ){
            analyseTokens(token.header,score,tempweight+tokenScores.tableHeader);
            analyseTokens(token.rows,score,tempweight+tokenScores.tableBody);
        }else if (token.type){
            tempweight+=tokenScores[token.type]
        }


        if(token.tokens){
            analyseTokens(token.tokens,score,tempweight);
        }else if (token.text){
            Score(token.text,score,tempweight);
        }
    }
}


function Index(path){
    data = fs.readFileSync(path,{encoding:'utf-8'})
    var fileScore= new Map();
    var fileData={
        "path": path.replace(pathStart,"").replace(".md",".html"),
        "title":path.replace(pathStart,"").replace(".md",".html"),
        "module": null,
        "data":[]
    }

    var frontMatter=fm(data);
    if (frontMatter.attributes && frontMatter.attributes.title){
        fileData.title=frontMatter.attributes.title;
        Score(frontMatter.attributes.title,fileScore,titleScore);
    }else{
        var pathSplit= path.split("/");
        fileData.title=pathSplit[pathSplit.length-1].replace(".md","");
    }
    //reomve front matter
    data=frontMatter.body;
    //remove math
    data=data.replace(/\$\$[\s\S]+?\$\$/g,"");
    analyseTokens(marked.lexer(data),fileScore,0);

    var possibleModules=path.match(/[A-Za-z]{2}[0-49][0-9]{2}/g);
    if (possibleModules){
        Score(possibleModules[0],fileScore,modulePath);
        fileData.module=possibleModules[0];
    }
    for (const key of fileScore.keys()) {
        if (fileScore.get(key)<MaxSafe){
            fileScore.delete(key)
        }
    }
    fileData.data=Array.from(fileScore.entries());
    return fileData;
}



var mdFiles =getFiles(pathStart);
var indexData=[]
for (const file of mdFiles) {
    var filedata=Index(file)
    indexData.push(filedata);
}

var arrayCompleteWords = Array.from(baseWords);
//arrayCompleteWords.sort();
var completeData={
    "words":arrayCompleteWords,
    "index":indexData
}
fs.writeFile(pathStart+"/search/index.json",JSON.stringify(completeData),(err)=>{console.log(err);});